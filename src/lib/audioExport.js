import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

// Converts a session recording to MP3 or WebM in the browser with
// ffmpeg.wasm. The converter (~32MB) loads only the first time someone
// exports, and stays loaded for the rest of the visit.
//
// Both are mono speech settings, like the app's own recorder:
// - WebM (Opus 32kbps): about 15MB an hour — the lighter file.
// - MP3 (48kbps): about 22MB an hour — plays on anything.
export const EXPORT_FORMATS = {
  mp3: { label: 'MP3', type: 'audio/mpeg', args: ['-vn', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k'] },
  webm: { label: 'WebM', type: 'audio/webm', args: ['-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'constrained', '-application', 'voip'] },
}

let loading = null
function getFFmpeg() {
  if (!loading) {
    const ffmpeg = new FFmpeg()
    loading = ffmpeg.load({ coreURL, wasmURL }).then(
      () => ffmpeg,
      (err) => {
        loading = null
        throw err
      },
    )
  }
  return loading
}

// Recordings already in the format asked for are handed back untouched.
export function needsConversion(blob, format) {
  const type = (blob.type || '').split(';')[0]
  return type !== EXPORT_FORMATS[format].type
}

// onProgress(0..1) reports the conversion; resolves to the new Blob.
export async function convertRecording(blob, format, onProgress) {
  if (!needsConversion(blob, format)) return blob
  return transcode(blob, format, onProgress)
}

// Uploaded audio above this bitrate is worth shrinking; the app's own
// recordings (24kbps) and already-small files are left alone.
const SHRINK_ABOVE_BPS = 48000

// Re-saves an uploaded recording as speech-quality WebM (Opus) when that
// makes it meaningfully lighter — a 128kbps MP3 comes out about a quarter
// of the size. Returns the original if it's already small, if shrinking
// saves under 10%, or if this device can't convert it.
export async function shrinkRecording(file, seconds, onProgress) {
  const bps = seconds ? (file.size * 8) / seconds : null
  if (bps != null ? bps <= SHRINK_ABOVE_BPS : file.size < 2 * 1024 * 1024) return file
  try {
    const out = await transcode(file, 'webm', onProgress)
    if (out.size > file.size * 0.9) return file
    const base = (file.name || 'recording').replace(/\.[^.]+$/, '') || 'recording'
    return new File([out], `${base}.webm`, { type: 'audio/webm' })
  } catch (err) {
    console.warn('Couldn’t shrink the recording; uploading it as is.', err)
    return file
  }
}

async function transcode(blob, format, onProgress) {
  const target = EXPORT_FORMATS[format]
  const ffmpeg = await getFFmpeg()
  const report = ({ progress }) => Number.isFinite(progress) && onProgress?.(Math.min(1, Math.max(0, progress)))
  ffmpeg.on('progress', report)
  const input = `in-${Date.now()}`
  const output = `out-${Date.now()}.${format}`
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await blob.arrayBuffer()))
    const code = await ffmpeg.exec(['-i', input, ...target.args, output])
    if (code !== 0) throw new Error('This recording couldn’t be converted.')
    const data = await ffmpeg.readFile(output)
    return new Blob([data], { type: target.type })
  } finally {
    ffmpeg.off('progress', report)
    await ffmpeg.deleteFile(input).catch(() => {})
    await ffmpeg.deleteFile(output).catch(() => {})
  }
}

// Cuts a recording into speech-quality chunks of `chunkSeconds` for
// transcription (services cap uploads at 25MB; 20 minutes of 24kbps mono
// Opus is about 4MB). Resolves to [{ start, blob }]. `seconds` is the
// recording's length if known; otherwise it cuts until the audio runs out.
export async function splitForTranscription(blob, seconds, chunkSeconds, onProgress) {
  const ffmpeg = await getFFmpeg()
  const input = `split-in-${Date.now()}`
  const chunks = []
  const total = seconds ? Math.ceil(seconds / chunkSeconds) : null
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await blob.arrayBuffer()))
    for (let i = 0; total == null ? i < 100 : i < total; i++) {
      const start = i * chunkSeconds
      const output = `split-${i}.webm`
      const code = await ffmpeg.exec([
        '-ss', String(start), '-t', String(chunkSeconds), '-i', input,
        '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', output,
      ])
      const data = code === 0 ? await ffmpeg.readFile(output).catch(() => null) : null
      await ffmpeg.deleteFile(output).catch(() => {})
      // Past the end there's only a container header left.
      if (!data || data.length < 2048) break
      chunks.push({ start, blob: new Blob([data], { type: 'audio/webm' }) })
      onProgress?.(total ? (i + 1) / total : null)
    }
  } finally {
    await ffmpeg.deleteFile(input).catch(() => {})
  }
  if (!chunks.length) throw new Error('This recording couldn’t be read.')
  return chunks
}
