import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/sessionRecorder.js'
import Icon from './Icon.jsx'
import './AudioPlayer.scss'

// Only one recording plays at a time: starting one pauses the rest.
const PLAY_EVENT = 'dnd-notes-audio-play'
const SPEEDS = [1, 1.5, 2]

// A session recording's player: play / pause, a seek bar, the time and a
// speed button (long sessions are easier to skim at 1.5× or 2×). It loads
// nothing until played, so a list of sessions stays light.
function AudioPlayer({ src, seconds, label = 'Session recording', compact = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(seconds || 0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onOther = (e) => {
      if (e.detail !== audioRef.current) audioRef.current?.pause()
    }
    window.addEventListener(PLAY_EVENT, onOther)
    return () => window.removeEventListener(PLAY_EVENT, onOther)
  }, [])

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    setError(null)
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio }))
    try {
      await audio.play()
    } catch (err) {
      if (err.name !== 'AbortError') setError('This recording couldn’t be played here.')
    }
  }

  function seek(value) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrent(value)
  }

  function nextSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const total = duration || seconds || 0
  const pct = total ? Math.min(100, (current / total) * 100) : 0

  return (
    <div className={`audio-player${compact ? ' audio-player--compact' : ''}${playing ? ' is-playing' : ''}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => {
          setPlaying(true)
          audioRef.current.playbackRate = speed
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onError={() => {
          setPlaying(false)
          setError('This recording couldn’t be loaded.')
        }}
      />
      <button
        type="button"
        className="audio-player__play"
        onClick={toggle}
        aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <input
        type="range"
        className="audio-player__seek"
        min={0}
        max={total || 1}
        step={1}
        value={Math.min(current, total || 1)}
        onChange={(e) => seek(Number(e.target.value))}
        style={{ '--played': `${pct}%` }}
        aria-label={`Seek in ${label}`}
        aria-valuetext={`${formatDuration(current)} of ${formatDuration(total)}`}
      />
      <span className="audio-player__time">
        {current > 0 || playing ? `${formatDuration(current)} / ` : ''}
        {formatDuration(total)}
      </span>
      <button type="button" className="audio-player__speed" onClick={nextSpeed} aria-label={`Playback speed ${speed}×`}>
        {speed}×
      </button>
      {error && (
        <p className="audio-player__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default AudioPlayer
