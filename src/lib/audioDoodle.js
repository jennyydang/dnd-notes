// A recording's "doodle": its loudness over time, boiled down to a short
// list of levels (0–1) that AudioDoodle draws as a hand-inked squiggle.

export const DOODLE_POINTS = 96

// Averages a long run of levels down to `n` (louder runs stay louder),
// then scales so the loudest is 1 — a quiet room still gets a shape.
export function toDoodle(levels, n = DOODLE_POINTS) {
  if (!levels?.length) return null
  const out = []
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * levels.length) / n)
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / n))
    let sum = 0
    let peak = 0
    for (let j = from; j < to && j < levels.length; j++) {
      sum += levels[j]
      peak = Math.max(peak, levels[j])
    }
    // Lean on the peaks a little, so laughs and shouts show.
    out.push((sum / (to - from)) * 0.6 + peak * 0.4)
  }
  const max = Math.max(...out)
  if (!max) return null // all silence: nothing to draw
  return out.map((v) => Math.round(Math.sqrt(v / max) * 100) / 100)
}

// Live levels while recording: an analyser on the microphone, sampled
// four times a second (cheap, and fine for hours).
export function trackLevels(stream) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  // Browsers can start an audio context suspended (it then hears only
  // silence); the tap on Record allows resuming it.
  ctx.resume?.().catch(() => {})
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  const levels = []
  let paused = false
  const id = setInterval(() => {
    if (paused) return
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    levels.push(Math.sqrt(sum / buf.length))
  }, 250)
  return {
    levels,
    pause: () => (paused = true),
    resume: () => (paused = false),
    stop: () => {
      clearInterval(id)
      source.disconnect()
      ctx.close().catch(() => {})
      return levels
    },
  }
}

// For a file (an upload, or a recording from before doodles): decode at
// a low sample rate to keep memory down, and skip very long files.
const DECODE_RATE = 8000
const MAX_DECODE_SECONDS = 3 * 60 * 60

export async function doodleFromAudio(source, seconds) {
  if (seconds && seconds > MAX_DECODE_SECONDS) return null
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return null
  const data = source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source)).arrayBuffer()
  const length = Math.max(1, Math.ceil((seconds || 60) * DECODE_RATE))
  const ctx = new Offline(1, length, DECODE_RATE)
  const audio = await ctx.decodeAudioData(data)
  const samples = audio.getChannelData(0)
  const step = Math.max(1, Math.floor(samples.length / (DOODLE_POINTS * 8)))
  const levels = []
  for (let i = 0; i < samples.length; i += step) {
    let sum = 0
    const end = Math.min(samples.length, i + step)
    for (let j = i; j < end; j++) sum += samples[j] * samples[j]
    levels.push(Math.sqrt(sum / (end - i)))
  }
  return toDoodle(levels)
}
