import { supabase } from './supabaseClient.js'

// One audio recording at a time, kept outside React so it carries on
// while the player moves between tabs (a component's own MediaRecorder
// would stop the moment its screen unmounted).
//
// A recording is for a session recap: `target` is that recap's id, or
// null for "the session being played now" — End Session attaches it to
// the recap it saves (see attachRecording).
export const AUDIO_BUCKET = 'session-audio'
// Speech-quality Opus/AAC: about 11MB an hour.
const BITS_PER_SECOND = 24000
// There's no size cap: Supabase's Free plan won't take a file over 50MB,
// so bigger recordings (any size) are cut into byte-for-byte pieces under that and stored side by side
// (session_notes.audio_parts lists them in order). Joining the pieces
// gives back the exact original file — the app does that to play or
// download it, so it's still one recording to the player.
export const PART_BYTES = 45 * 1024 * 1024

const AUDIO_TYPES = { webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' }

// A recap's audio files in order: its pieces, or just the one file.
export function audioPartsOf(session) {
  if (Array.isArray(session?.audioParts) && session.audioParts.length) return session.audioParts
  return session?.audioPath ? [session.audioPath] : []
}

export const isSplitRecording = (session) => audioPartsOf(session).length > 1

function typeForPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  return AUDIO_TYPES[ext] || 'audio/webm'
}

// Downloads a recap's pieces and joins them into one Blob (the original
// file). onProgress(0..1) reports how far along it is.
export async function loadRecordingBlob(session, onProgress) {
  const parts = audioPartsOf(session)
  const blobs = []
  for (const [i, path] of parts.entries()) {
    const url = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Couldn’t load part ${i + 1} of ${parts.length} of the recording.`)
    blobs.push(await res.blob())
    onProgress?.((i + 1) / parts.length)
  }
  return new Blob(blobs, { type: typeForPath(parts[0]) })
}

// Saves a recap's recording to the device as one MP3 or WebM file, whole
// even when it's stored in pieces. A recording already in that format is
// saved as is; otherwise it's converted first (see audioExport.js).
// onProgress({ stage: 'loading' | 'converting', value: 0..1 }).
export async function downloadSessionRecording(session, format, onProgress) {
  const original = await loadRecordingBlob(session, (value) => onProgress?.({ stage: 'loading', value }))
  const { convertRecording, needsConversion } = await import('./audioExport.js')
  let blob = original
  if (needsConversion(original, format)) {
    onProgress?.({ stage: 'converting', value: 0 })
    blob = await convertRecording(original, format, (value) => onProgress?.({ stage: 'converting', value }))
  }
  const name = `${(session.title || 'session-recording').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'session-recording'}.${format}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
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

// Uploads a recording, in pieces when it's over PART_BYTES. Returns the
// stored paths in order; on a failure, any pieces already up are removed.
async function upload(file, ext) {
  const id = crypto.randomUUID()
  const count = Math.max(1, Math.ceil(file.size / PART_BYTES))
  const contentType = file.type || typeForPath(`x.${ext}`)
  const paths = []
  try {
    for (let i = 0; i < count; i++) {
      const path = count === 1 ? `${id}.${ext}` : `${id}-part${i + 1}of${count}.${ext}`
      const piece = count === 1 ? file : file.slice(i * PART_BYTES, (i + 1) * PART_BYTES, contentType)
      const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, piece, { contentType })
      if (error) throw new Error(count === 1 ? error.message : `Part ${i + 1} of ${count}: ${error.message}`)
      paths.push(path)
    }
  } catch (err) {
    if (paths.length) await supabase.storage.from(AUDIO_BUCKET).remove(paths)
    throw err
  }
  return paths
}

const storedParts = (row) => (Array.isArray(row?.audio_parts) && row.audio_parts.length ? row.audio_parts : row?.audio_path ? [row.audio_path] : [])

// Saves an audio file onto a recap, replacing (and deleting) any it had.
async function saveAudio(sessionId, file, ext, seconds, marks = []) {
  const { data: before } = await supabase.from('session_notes').select('*').eq('id', sessionId).single()
  const paths = await upload(file, ext)
  // audio_parts is only written when needed (pieces, or clearing old
  // ones), so single-file recordings still save before its SQL is run.
  const patch = { audio_path: paths[0], audio_seconds: seconds ?? null }
  if (paths.length > 1 || before?.audio_parts) patch.audio_parts = paths.length > 1 ? paths : null
  const { error } = await supabase.from('session_notes').update(patch).eq('id', sessionId)
  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove(paths)
    throw new Error(
      paths.length > 1 && /audio_parts/.test(error.message)
        ? 'Recordings over 45MB are saved in pieces, which needs the latest supabase/schema.sql (the audio_parts column).'
        : error.message,
    )
  }
  const old = storedParts(before)
  if (old.length) await supabase.storage.from(AUDIO_BUCKET).remove(old)
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

export async function removeAudio(sessionId, session) {
  const parts = audioPartsOf(session)
  const patch = { audio_path: null, audio_seconds: null }
  if (session?.audioParts) patch.audio_parts = null
  const { error } = await supabase.from('session_notes').update(patch).eq('id', sessionId)
  if (error) throw new Error(error.message)
  if (parts.length) await supabase.storage.from(AUDIO_BUCKET).remove(parts)
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
