import { useSessionRecorder } from '../../hooks/useSessionRecorder.js'
import {
  clearRecorderError,
  discardRecording,
  formatDuration,
  pauseRecording,
  resumeRecording,
  stopRecording,
} from '../../lib/sessionRecorder.js'
import Icon from '../Icon.jsx'
import './RecordingBar.scss'

// While audio is being recorded, a small bar on every screen: the time,
// pause / resume and stop. A live-session recording that's been stopped
// waits here ("ready") until End Session attaches it to the recap.
function RecordingBar() {
  const rec = useSessionRecorder()
  const live = rec.status === 'recording' || rec.status === 'paused'
  const waiting = rec.status === 'idle' && rec.pending && !rec.target

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
          Recording ready ({formatDuration(rec.pending.seconds)}) — it’s saved with the recap when you end the session
        </span>
        <button
          type="button"
          className="recording-bar__btn"
          onClick={() => window.confirm('Discard this recording?') && discardRecording()}
          aria-label="Discard recording"
        >
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
        {rec.status === 'paused' ? 'Paused' : 'Recording'} <strong>{formatDuration(rec.seconds)}</strong>
      </span>
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
