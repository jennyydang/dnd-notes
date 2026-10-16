import { supabase } from './supabaseClient.js'

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

const idle = { status: 'idle', target: null, error: null, pending: null, startedAt: 0, banked: 0, marks: [] }
// status: idle | recording | paused | saving
// pending: a finished recording not yet attached ({ blob, seconds, ext, marks })
// marks: bookmarks made while recording ([{ t: seconds, label }])
let state = idle
let recorder = null
let stream = null
let chunks = []
let wakeLock = null
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
  try {
    recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: BITS_PER_SECOND })
  } catch {
    // Some browsers refuse a format or bitrate they don't like: take
    // their own defaults rather than not recording at all.
    try {
      recorder = new MediaRecorder(stream)
    } catch (err) {
      release()
      set({ error: `This browser couldn’t start recording: ${err?.message || err}` })
      return
    }
  }
  chunks = []
  recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data)
  // Chunks every 10s, so a long recording isn't one huge buffer at stop.
  recorder.start(10000)
  window.addEventListener('beforeunload', warnOnLeave)
  document.addEventListener('visibilitychange', onVisible)
  holdScreenOn()
  set({ status: 'recording', target, startedAt: Date.now(), banked: 0, pending: null, marks: [] })
}

// Bookmarks this moment of the recording ("big fight", "funny bit") — named
// later on the recap's page. Returns the mark.
export function addRecordingMark(label = '') {
  if (state.status !== 'recording' && state.status !== 'paused') return null
  const mark = { t: elapsedSeconds(), label: label || `Mark ${state.marks.length + 1}` }
  set({ marks: [...state.marks, mark] })
  return mark
}

export function pauseRecording() {
  if (state.status !== 'recording') return
  recorder.pause()
  set({ status: 'paused', banked: state.banked + (Date.now() - state.startedAt) })
}

export function resumeRecording() {
  if (state.status !== 'paused') return
  recorder.resume()
  set({ status: 'recording', startedAt: Date.now() })
}

function release() {
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
      release()
      if (!blob.size) {
        set({ ...idle, error: 'The recording came out empty — the browser didn’t capture any audio. Try again.' })
        resolve(null)
        return
      }
      const pending = { blob, seconds, ext, marks: state.marks }
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
async function saveAudio(sessionId, file, ext, seconds, marks = []) {
  const { data: before } = await supabase.from('session_notes').select('audio_path').eq('id', sessionId).single()
  const path = await upload(file, ext)
  const { error } = await supabase
    .from('session_notes')
    .update({ audio_path: path, audio_seconds: seconds ?? null })
    .eq('id', sessionId)
  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove([path])
    throw new Error(error.message)
  }
  if (before?.audio_path) await supabase.storage.from(AUDIO_BUCKET).remove([before.audio_path])
  // Marks go on separately: if they can't be saved (say the audio_marks
  // column isn't there yet), the recording itself is still kept.
  try {
    await saveMarks(sessionId, marks)
  } catch (err) {
    console.warn('Recording marks not saved:', err.message)
  }
}

// A recap's recording bookmarks, sorted by time.
export async function saveMarks(sessionId, marks) {
  const sorted = [...(marks || [])].sort((a, b) => a.t - b.t)
  const { error } = await supabase.from('session_notes').update({ audio_marks: sorted }).eq('id', sessionId)
  if (error) throw new Error(error.message)
  return sorted
}

// Uploads the finished (pending) recording onto a recap. If it fails,
// the recording is kept (with its recap) so it can be retried or saved
// to the device — never silently dropped.
export async function attachRecording(sessionId) {
  const pending = state.pending
  if (!pending) return
  set({ status: 'saving', error: null, target: sessionId })
  try {
    await saveAudio(sessionId, pending.blob, pending.ext, pending.seconds, pending.marks)
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
  await saveAudio(sessionId, file, ext, seconds)
}

export async function removeAudio(sessionId, path) {
  const { error } = await supabase
    .from('session_notes')
    .update({ audio_path: null, audio_seconds: null })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
  if (path) await supabase.storage.from(AUDIO_BUCKET).remove([path])
  await saveMarks(sessionId, []).catch(() => {})
}

// Tries the failed upload again, onto the same recap.
export function retryRecording() {
  if (state.pending && state.target) return attachRecording(state.target).catch(() => {})
  return Promise.resolve()
}

// The finished recording as a file on the device (a backup, or when it
// won't upload).
export function downloadRecording() {
  const pending = state.pending
  if (!pending) return
  const url = URL.createObjectURL(pending.blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')
  a.href = url
  a.download = `Session recording ${stamp}.${pending.ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function clearRecorderError() {
  set({ error: null })
}
