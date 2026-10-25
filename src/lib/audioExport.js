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
  const target = EXPORT_FORMATS[format]
  if (!needsConversion(blob, format)) return blob
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
