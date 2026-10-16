import { supabase } from './supabaseClient.js'
import { doodleFromAudio, toDoodle, trackLevels } from './audioDoodle.js'

// One audio recording at a time, kept outside React so it carries on
// while the player moves between tabs (a component's own MediaRecorder
// would stop the moment its screen unmounted).
//
// A recording is for a session recap: `target` is that recap's id, or
// null for "the session being played now" — End Session attaches it to
// the recap it saves (see attachRecording).
export const AUDIO_BUCKET = 'session-audio'
// Speech-quality Opus/AAC: about 11MB an hour, so a four-hour session
// stays under Supabase's default 50MB upload limit.
const BITS_PER_SECOND = 24000
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024
const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

const idle = { status: 'idle', target: null, error: null, pending: null, startedAt: 0, banked: 0 }
// status: idle | recording | paused | saving
// pending: a finished recording not yet attached ({ blob, seconds, ext })
let state = idle
let recorder = null
let stream = null
let chunks = []
let wakeLock = null
let levels = null // the microphone's loudness as it records (for the doodle)
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

export function subscribeRecorder(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getRecorderState() {
  return state
}

export const recordingSupported = () =>
  typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && 'MediaRecorder' in window

// Seconds recorded so far (pauses excluded).
export function elapsedSeconds(s = state) {
  const running = s.status === 'recording' ? Date.now() - s.startedAt : 0
  return Math.floor((s.banked + running) / 1000)
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Leaving or reloading the page would lose an unsaved recording.
function warnOnLeave(event) {
  event.preventDefault()
  event.returnValue = ''
}

async function holdScreenOn() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen')
  } catch {
    wakeLock = null // not supported, or the page isn't visible
  }
}
// The browser drops a wake lock when the tab is hidden; take it back.
function onVisible() {
  if (document.visibilityState === 'visible' && state.status === 'recording') holdScreenOn()
}

export async function startRecording(target = null) {
  if (state.status !== 'idle') return
  if (!recordingSupported()) {
    set({ error: 'This browser can’t record audio.' })
    return
  }
  set({ error: null })
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (err) {
    set({
      error:
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked — allow it in your browser’s site settings to record.'
          : `Couldn’t start the microphone: ${err?.message || err}`,
    })
    return
  }
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t))
  recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: BITS_PER_SECOND })
  chunks = []
  recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data)
  // Chunks every 10s, so a long recording isn't one huge buffer at stop.
  recorder.start(10000)
  try {
    levels = trackLevels(stream)
  } catch {
    levels = null // no doodle, but the recording still works
  }
  window.addEventListener('beforeunload', warnOnLeave)
  document.addEventListener('visibilitychange', onVisible)
  holdScreenOn()
  set({ status: 'recording', target, startedAt: Date.now(), banked: 0, pending: null })
}

export function pauseRecording() {
  if (state.status !== 'recording') return
  recorder.pause()
  levels?.pause()
  set({ status: 'paused', banked: state.banked + (Date.now() - state.startedAt) })
}

export function resumeRecording() {
  if (state.status !== 'paused') return
  recorder.resume()
  levels?.resume()
  set({ status: 'recording', startedAt: Date.now() })
}

function release() {
  levels?.stop()
  levels = null
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  recorder = null
  chunks = []
  wakeLock?.release?.().catch(() => {})
  wakeLock = null
  window.removeEventListener('beforeunload', warnOnLeave)
  document.removeEventListener('visibilitychange', onVisible)
}

// Stops the microphone and keeps the audio. A recording for a saved recap
// is uploaded and attached straight away; one for the live session waits
// (as `pending`) for End Session.
export function stopRecording() {
  if (state.status !== 'recording' && state.status !== 'paused') return Promise.resolve(state.pending)
  const seconds = elapsedSeconds()
  const target = state.target
  return new Promise((resolve) => {
    recorder.onstop = async () => {
      const type = recorder.mimeType || chunks[0]?.type || 'audio/webm'
      const blob = new Blob(chunks, { type })
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
      let doodle = levels ? toDoodle(levels.stop()) : null
      release()
      // No live levels (or only silence heard): draw it from the file.
      if (!doodle) doodle = await doodleFromAudio(blob, seconds).catch(() => null)
      const pending = { blob, seconds, ext, doodle }
      set({ status: 'idle', pending, banked: 0 })
      if (target) {
        try {
          await attachRecording(target)
        } catch {
          // error is in state; the recording stays pending to retry
        }
      }
      resolve(state.pending)
    }
    recorder.stop()
  })
}

export function discardRecording() {
  if (recorder) {
    recorder.onstop = null
    try {
      recorder.stop()
    } catch {
      // already stopped
    }
  }
  release()
  set(idle)
}

async function upload(file, ext) {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error('That recording is over 50MB — too big to upload. (Try a shorter clip.)')
  }
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw new Error(error.message)
  return path
}

// Saves an audio file onto a recap, replacing (and deleting) any it had.
async function saveAudio(sessionId, file, ext, seconds, doodle) {
  const { data: before } = await supabase.from('session_notes').select('audio_path').eq('id', sessionId).single()
  const path = await upload(file, ext)
  const { error } = await supabase
    .from('session_notes')
    .update({ audio_path: path, audio_seconds: seconds ?? null, audio_doodle: doodle ?? null })
    .eq('id', sessionId)
  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove([path])
    throw new Error(error.message)
  }
  if (before?.audio_path) await supabase.storage.from(AUDIO_BUCKET).remove([before.audio_path])
}

// Uploads the finished (pending) recording onto a recap.
export async function attachRecording(sessionId) {
  const pending = state.pending
  if (!pending) return
  set({ status: 'saving', error: null })
  try {
    await saveAudio(sessionId, pending.blob, pending.ext, pending.seconds, pending.doodle)
    set({ ...idle })
  } catch (err) {
    set({ status: 'idle', error: `The recording didn’t save: ${err.message}` })
    throw err
  }
}

// An audio file chosen from the device, for a recap.
export async function uploadAudioFile(sessionId, file) {
  const ext = (file.name.split('.').pop() || 'webm').toLowerCase()
  const seconds = await new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null)
    audio.onerror = () => resolve(null)
    audio.src = URL.createObjectURL(file)
  })
  let doodle = null
  try {
    doodle = await doodleFromAudio(file, seconds)
  } catch {
    doodle = null // a format the browser can't decode: no doodle
  }
  await saveAudio(sessionId, file, ext, seconds, doodle)
}

// Draws (and saves) a doodle for a recording made before doodles.
export async function saveDoodle(sessionId, audioUrl, seconds) {
  const doodle = await doodleFromAudio(audioUrl, seconds)
  if (!doodle) return null
  const { error } = await supabase.from('session_notes').update({ audio_doodle: doodle }).eq('id', sessionId)
  if (error) throw new Error(error.message)
  return doodle
}

export async function removeAudio(sessionId, path) {
  const { error } = await supabase
    .from('session_notes')
    .update({ audio_path: null, audio_seconds: null, audio_doodle: null })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
  if (path) await supabase.storage.from(AUDIO_BUCKET).remove([path])
}

export function clearRecorderError() {
  set({ error: null })
}
