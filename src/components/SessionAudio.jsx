import { useEffect, useRef, useState } from 'react'
import { useSessionRecorder } from '../hooks/useSessionRecorder.js'
import {
  AUDIO_BUCKET,
  formatDuration,
  addRecordingMark,
  downloadSessionRecording,
  isSplitRecording,
  loadRecordingBlob,
  recordingSupported,
  removeAudio,
  startRecording,
  stopRecording,
  uploadAudioFile,
} from '../lib/sessionRecorder.js'
import { getPublicUrl } from '../lib/storage.js'
import Icon from './Icon.jsx'
import AudioPlayer from './AudioPlayer.jsx'
import RecordingMarks from './RecordingMarks.jsx'

export const AUDIO_SEEK_EVENT = 'dnd-notes-audio-seek'

// A session recap's audio: play it, or record / upload one. Recording
// runs in the shared recorder, so it keeps going on other tabs (the
// recording bar shows it) and attaches itself here when stopped.
const exportLabel = ({ stage, value }) =>
  `${stage === 'converting' ? 'Converting' : 'Preparing'}… ${Math.round(value * 100)}%`

function SessionAudio({ session, onChanged }) {
  const rec = useSessionRecorder()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // A recording over 45MB is stored in pieces: the player and Download
  // join them back into the one file.
  const split = isSplitRecording(session)
  const src = split ? null : getPublicUrl(AUDIO_BUCKET, session.audioPath)
  const hasAudio = Boolean(session.audioPath)
  const [exporting, setExporting] = useState(null) // { format, stage, value }
  const [uploading, setUploading] = useState(null) // { stage, value }

  function exportAs(format) {
    setExporting({ format, stage: 'loading', value: 0 })
    setError(null)
    downloadSessionRecording(session, format, (p) => setExporting({ format, ...p }))
      .catch((err) => setError(`Couldn’t export the recording: ${err.message}`))
      .finally(() => setExporting(null))
  }
  const mine = rec.target === session.id
  const live = mine && (rec.status === 'recording' || rec.status === 'paused')
  const recorderBusy = rec.status !== 'idle'
  const player = useRef(null)
  const [position, setPosition] = useState(0)

  // The highlight reel's bookmark tiles jump the recording to their moment.
  useEffect(() => {
    function onSeek(event) {
      if (event.detail?.sessionId !== session.id) return
      player.current?.seek(event.detail.t, true)
      document.querySelector('.session-audio')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener(AUDIO_SEEK_EVENT, onSeek)
    return () => window.removeEventListener(AUDIO_SEEK_EVENT, onSeek)
  }, [session.id])

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
    run(() => uploadAudioFile(session.id, file, setUploading)).finally(() => setUploading(null))
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
          {rec.marks.length > 0 && (
            <span className="session-audio__marks-count">
              <Icon name="bookmark" /> {rec.marks.length}
            </span>
          )}
          <button type="button" className="btn" onClick={() => addRecordingMark()}>
            <Icon name="bookmark" /> Mark
          </button>
          <button type="button" className="btn btn--primary" onClick={() => stopRecording().then(() => onChanged?.())}>
            <Icon name="stop" /> Stop &amp; save
          </button>
        </div>
      ) : mine && rec.status === 'saving' ? (
        <p className="session-audio__hint">Saving the recording…</p>
      ) : hasAudio ? (
        <>
          <AudioPlayer
            key={session.audioPath}
            src={src}
            load={split ? (onProgress) => loadRecordingBlob(session, onProgress) : undefined}
            seconds={session.audioSeconds}
            label={`${session.title || 'Session'} recording`}
            marks={session.audioMarks}
            controlRef={player}
            onTime={setPosition}
          />
          <RecordingMarks
            key={`${session.audioPath}-${session.audioMarks.length}`}
            sessionId={session.id}
            marks={session.audioMarks}
            player={player}
            position={position}
            onSaved={onChanged}
          />
        </>
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
            <Icon name="upload" /> {uploading?.stage === 'shrinking'
              ? `Shrinking… ${Math.round(uploading.value * 100)}%`
              : busy
                ? 'Uploading…'
                : 'Upload audio'}
          </button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={pickFile} />
          {hasAudio && (
            <>
              {['mp3', 'webm'].map((format) => (
                <button
                  key={format}
                  type="button"
                  className="btn btn--text"
                  disabled={exporting != null}
                  title={format === 'webm' ? 'Smaller file (about 15MB an hour)' : 'Plays on anything (about 22MB an hour)'}
                  onClick={() => exportAs(format)}
                >
                  <Icon name="download" />{' '}
                  {exporting?.format === format ? exportLabel(exporting) : `Download ${format === 'webm' ? 'WebM' : 'MP3'}`}
                </button>
              ))}
              <button
                type="button"
                className="btn btn--text session-audio__remove"
                disabled={busy}
                onClick={() =>
                  window.confirm('Remove this recording? The audio file is deleted and can’t be recovered.') &&
                  run(() => removeAudio(session.id, session))
                }
              >
                <Icon name="trash" /> Remove recording
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
