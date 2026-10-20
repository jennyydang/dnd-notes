import { useSessionRecorder } from '../../hooks/useSessionRecorder.js'
import { useState } from 'react'
import {
  addRecordingMark,
  clearRecorderError,
  discardRecording,
  downloadRecording,
  formatDuration,
  pauseRecording,
  resumeRecording,
  retryRecording,
  stopRecording,
} from '../../lib/sessionRecorder.js'
import Icon from '../Icon.jsx'
import './RecordingBar.scss'

// While audio is being recorded, a small bar on every screen: the time,
// pause / resume and stop. A live-session recording that's been stopped
// waits here ("ready") until End Session attaches it to the recap.
function RecordingBar() {
  const rec = useSessionRecorder()
  const [flash, setFlash] = useState(null) // "Marked 12:03", briefly
  const live = rec.status === 'recording' || rec.status === 'paused'
  const waiting = rec.status === 'idle' && rec.pending && !rec.target
  const discard = () =>
    window.confirm('Discard this recording? It hasn’t been saved anywhere.') && discardRecording()

  // A finished recording that didn't upload: keep it, and offer to try
  // again or save it to the device — never let it quietly disappear.
  if (rec.status === 'idle' && rec.pending && rec.error) {
    return (
      <div className="recording-bar recording-bar--error" role="alert">
        <Icon name="mic" />
        <span className="recording-bar__text" title={rec.error}>
          Recording not saved ({formatDuration(rec.pending.seconds)}) — {rec.error.replace(/^The recording didn’t save: /, '')}
        </span>
        {rec.target && (
          <button type="button" className="recording-bar__btn" onClick={retryRecording} aria-label="Try saving again" title="Try again">
            <Icon name="sync" />
          </button>
        )}
        <button type="button" className="recording-bar__btn" onClick={downloadRecording} aria-label="Save to this device" title="Save to this device">
          <Icon name="download" />
        </button>
        <button type="button" className="recording-bar__btn" onClick={discard} aria-label="Discard recording" title="Discard">
          <Icon name="trash" />
        </button>
      </div>
    )
  }

  if (rec.error && !live) {
    return (
      <div className="recording-bar recording-bar--error" role="alert">
        <Icon name="mic" />
        <span className="recording-bar__text">{rec.error}</span>
        <button type="button" className="recording-bar__btn" onClick={clearRecorderError} aria-label="Dismiss">
          <Icon name="close" />
        </button>
      </div>
    )
  }
  if (rec.status === 'saving') {
    return (
      <div className="recording-bar" role="status">
        <span className="recording-bar__spinner" aria-hidden="true" />
        <span className="recording-bar__text">Saving recording…</span>
      </div>
    )
  }
  if (waiting) {
    return (
      <div className="recording-bar" role="status">
        <Icon name="mic" />
        <span className="recording-bar__text">
          Recording ready ({formatDuration(rec.pending.seconds)}) — not saved yet: End session and save the recap to keep it
        </span>
        <button type="button" className="recording-bar__btn" onClick={downloadRecording} aria-label="Save to this device" title="Save to this device">
          <Icon name="download" />
        </button>
        <button type="button" className="recording-bar__btn" onClick={discard} aria-label="Discard recording" title="Discard">
          <Icon name="trash" />
        </button>
      </div>
    )
  }
  if (!live) return null

  return (
    <div className={`recording-bar${rec.status === 'paused' ? ' is-paused' : ''}`} role="status">
      <span className="recording-bar__dot" aria-hidden="true" />
      <span className="recording-bar__text">
        {flash || (
          <>
            {rec.status === 'paused' ? 'Paused' : 'Recording'} <strong>{formatDuration(rec.seconds)}</strong>
          </>
        )}
      </span>
      {/* Bookmark this moment, to find it again when listening back. */}
      <button
        type="button"
        className="recording-bar__btn recording-bar__btn--mark"
        onClick={() => {
          const mark = addRecordingMark()
          if (!mark) return
          setFlash(`Marked ${formatDuration(mark.t)}`)
          setTimeout(() => setFlash(null), 1500)
        }}
        aria-label="Mark this moment"
        title="Mark this moment"
      >
        <Icon name="bookmark" />
        {rec.marks.length > 0 && <span className="recording-bar__count">{rec.marks.length}</span>}
      </button>
      <button
        type="button"
        className="recording-bar__btn"
        onClick={rec.status === 'paused' ? resumeRecording : pauseRecording}
        aria-label={rec.status === 'paused' ? 'Resume recording' : 'Pause recording'}
      >
        <Icon name={rec.status === 'paused' ? 'mic' : 'pause'} />
      </button>
      <button type="button" className="recording-bar__btn recording-bar__btn--stop" onClick={() => stopRecording()} aria-label="Stop recording">
        <Icon name="stop" />
      </button>
    </div>
  )
}

export default RecordingBar
