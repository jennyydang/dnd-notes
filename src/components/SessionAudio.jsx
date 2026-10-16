import { useRef, useState } from 'react'
import { useSessionRecorder } from '../hooks/useSessionRecorder.js'
import {
  AUDIO_BUCKET,
  formatDuration,
  recordingSupported,
  removeAudio,
  startRecording,
  stopRecording,
  uploadAudioFile,
} from '../lib/sessionRecorder.js'
import { getPublicUrl } from '../lib/storage.js'
import Icon from './Icon.jsx'
import AudioPlayer from './AudioPlayer.jsx'

// A session recap's audio: play it, or record / upload one. Recording
// runs in the shared recorder, so it keeps going on other tabs (the
// recording bar shows it) and attaches itself here when stopped.
function SessionAudio({ session, onChanged }) {
  const rec = useSessionRecorder()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const src = getPublicUrl(AUDIO_BUCKET, session.audioPath)
  const mine = rec.target === session.id
  const live = mine && (rec.status === 'recording' || rec.status === 'paused')
  const recorderBusy = rec.status !== 'idle'

  async function run(task) {
    setBusy(true)
    setError(null)
    try {
      await task()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function record() {
    if (session.audioPath && !window.confirm('Replace this session’s recording with a new one?')) return
    startRecording(session.id)
  }

  function pickFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (session.audioPath && !window.confirm('Replace this session’s recording with this file?')) return
    run(() => uploadAudioFile(session.id, file))
  }

  return (
    <section className="session-audio" aria-label="Session recording">
      <h4 className="session-audio__title">
        <Icon name="mic" /> Recording
        {session.audioSeconds ? <span className="session-audio__length">{formatDuration(session.audioSeconds)}</span> : null}
      </h4>

      {live ? (
        <div className="session-audio__live" role="status">
          <span className={`session-audio__dot${rec.status === 'paused' ? ' is-paused' : ''}`} aria-hidden="true" />
          {rec.status === 'paused' ? 'Paused' : 'Recording'} · {formatDuration(rec.seconds)}
          <button type="button" className="btn btn--primary" onClick={() => stopRecording().then(() => onChanged?.())}>
            <Icon name="stop" /> Stop &amp; save
          </button>
        </div>
      ) : mine && rec.status === 'saving' ? (
        <p className="session-audio__hint">Saving the recording…</p>
      ) : src ? (
        <AudioPlayer key={src} src={src} seconds={session.audioSeconds} label={`${session.title || 'Session'} recording`} />
      ) : (
        <p className="session-audio__hint">No recording yet. Record the table as you play, or upload one.</p>
      )}

      {!live && (
        <div className="session-audio__actions">
          {recordingSupported() && (
            <button
              type="button"
              className="btn"
              onClick={record}
              disabled={busy || recorderBusy}
              title={recorderBusy ? 'Another recording is in progress' : undefined}
            >
              <Icon name="mic" /> {session.audioPath ? 'Record again' : 'Record'}
            </button>
          )}
          <button type="button" className="btn btn--text" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" /> {busy ? 'Uploading…' : 'Upload audio'}
          </button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={pickFile} />
          {src && (
            <>
              <a className="btn btn--text" href={src} download>
                <Icon name="download" /> Download
              </a>
              <button
                type="button"
                className="btn btn--text session-audio__remove"
                disabled={busy}
                onClick={() =>
                  window.confirm('Delete this recording? This can’t be undone.') &&
                  run(() => removeAudio(session.id, session.audioPath))
                }
              >
                <Icon name="trash" /> Delete
              </button>
            </>
          )}
        </div>
      )}
      {(error || (mine && rec.error)) && <p className="field-error">{error || rec.error}</p>}
    </section>
  )
}

export default SessionAudio
