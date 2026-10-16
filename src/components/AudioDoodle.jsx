import { useMemo } from 'react'
import './AudioDoodle.scss'

const W = 600
const H = 100
const MID = H / 2
const PAD = 14

// Same doodle every time for the same recording: jitter from a seeded
// random sequence (seeded by the levels themselves).
function seeded(levels) {
  let a = Math.floor(levels.reduce((sum, v, i) => sum + v * (i + 7) * 997, 0)) || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A smooth line through points (Catmull-Rom as cubic Béziers).
function smooth(points) {
  if (points.length < 2) return ''
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

// A little four-point sparkle, for the loudest moments.
function sparkle(x, y, r) {
  const k = r * 0.28
  return `M${x},${y - r} Q${x + k},${y - k} ${x + r},${y} Q${x + k},${y + k} ${x},${y + r} Q${x - k},${y + k} ${x - r},${y} Q${x - k},${y - k} ${x},${y - r}Z`
}

// The loudest few moments, spread out (not three neighbours).
function highlights(levels, count = 3) {
  const order = levels.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])
  const picked = []
  for (const [v, i] of order) {
    if (v < 0.55 || picked.length >= count) break
    if (picked.every((j) => Math.abs(j - i) > levels.length / 8)) picked.push(i)
  }
  return picked
}

// A recording drawn as an ink squiggle: it swings wide where the table
// was loud and settles where it was quiet, with sparkles on the biggest
// moments. With `progress` (0–1) it doubles as the playback bar, and
// `onSeek(fraction)` makes it tappable.
function AudioDoodle({ doodle, progress = null, onSeek, compact = false, label = 'Recording doodle' }) {
  const shape = useMemo(() => {
    if (!doodle?.length) return null
    const rand = seeded(doodle)
    const n = doodle.length
    const step = (W - PAD * 2) / (n - 1)
    const points = doodle.map((v, i) => {
      const amp = (3 + v * (MID - 12)) * (0.85 + rand() * 0.3)
      const side = i % 2 ? 1 : -1
      return [PAD + i * step + (rand() - 0.5) * step * 0.6, MID + side * amp]
    })
    const ink = smooth(points)
    // A second, fainter pass slightly off the first: the "sketched" look.
    const echo = smooth(points.map(([x, y]) => [x + 1.6 + rand() * 1.2, y + (rand() - 0.5) * 3]))
    const baseline = smooth(
      Array.from({ length: 9 }, (_, i) => [PAD + (i * (W - PAD * 2)) / 8, MID + (rand() - 0.5) * 2.5]),
    )
    const stars = highlights(doodle).map((i) => {
      const [x, y] = points[i]
      const top = Math.max(10, Math.min(y, MID - doodle[i] * (MID - 12)) - 9)
      return { x, y: top, r: 5 + rand() * 2.5, at: i / (n - 1) }
    })
    return { ink, echo, baseline, stars }
  }, [doodle])

  if (!shape) return null
  const played = progress == null ? null : Math.max(0, Math.min(1, progress))
  const clipId = `doodle-clip-${Math.round((doodle[0] ?? 0) * 1e4)}-${doodle.length}`

  function seek(event) {
    if (!onSeek) return
    const r = event.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)))
  }

  return (
    <svg
      className={`audio-doodle${compact ? ' audio-doodle--compact' : ''}${onSeek ? ' audio-doodle--seekable' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role={onSeek ? 'slider' : 'img'}
      aria-label={label}
      {...(onSeek
        ? { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((played || 0) * 100), tabIndex: 0 }
        : {})}
      onClick={seek}
      onKeyDown={(e) => {
        if (!onSeek || played == null) return
        if (e.key === 'ArrowRight') onSeek(Math.min(1, played + 0.02))
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, played - 0.02))
      }}
    >
      {played != null && (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W * played} height={H} />
          </clipPath>
        </defs>
      )}
      <path className="audio-doodle__baseline" d={shape.baseline} />
      <path className="audio-doodle__echo" d={shape.echo} />
      <path className={`audio-doodle__ink${played != null ? ' is-unplayed' : ''}`} d={shape.ink} />
      {played != null && <path className="audio-doodle__ink" d={shape.ink} clipPath={`url(#${clipId})`} />}
      {shape.stars.map((s) => (
        <path
          key={s.at}
          className={`audio-doodle__star${played != null && played >= s.at ? ' is-reached' : ''}`}
          d={sparkle(s.x, s.y, s.r)}
        />
      ))}
      {played != null && played > 0 && played < 1 && (
        <line className="audio-doodle__head" x1={W * played} x2={W * played} y1={6} y2={H - 6} />
      )}
    </svg>
  )
}

export default AudioDoodle
