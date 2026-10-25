import { useContext, useEffect, useMemo, useState } from 'react'
import { CampaignDataContext } from '../hooks/useCampaignData.js'
import { useAiConnection } from '../hooks/useAiConnection.js'
import { supabase } from '../lib/supabaseClient.js'
import {
  appendDraftToNotes,
  clock,
  draftRecap,
  estimateCost,
  getTranscribeKey,
  loadTranscript,
  removeTranscript,
  saveTranscribeKey,
  segmentAt,
  transcribeSession,
  transcriptText,
} from '../lib/transcribe.js'
import { downloadFile, safeFileName } from '../lib/exportNotes.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './SessionTranscript.scss'

const NAME_TYPES = ['npc', 'place', 'character', 'creature', 'loot', 'quest']
const STAGES = { loading: 'Loading the recording', preparing: 'Preparing the audio', transcribing: 'Transcribing' }

function Highlighted({ text, query }) {
  if (!query) return text
  const lower = text.toLowerCase()
  const parts = []
  let at = 0
  for (let i = lower.indexOf(query); i >= 0; i = lower.indexOf(query, at)) {
    parts.push(text.slice(at, i), <mark key={i}>{text.slice(i, i + query.length)}</mark>)
    at = i + query.length
  }
  parts.push(text.slice(at))
  return parts
}

// A recap recording's transcript: make one (OpenAI Whisper, the player's
// key), read and search it, tap a line to hear that moment, and draft the
// recap from it.
function SessionTranscript({ session, player, position, onChanged }) {
  const campaign = useContext(CampaignDataContext)
  const connection = useAiConnection()
  const [transcript, setTranscript] = useState(undefined) // undefined = loading, null = none
  const [job, setJob] = useState(null) // { stage, value }
  const [error, setError] = useState(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [hasKey, setHasKey] = useState(() => Boolean(getTranscribeKey()))
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null) // { recap, highlights } | 'working'

  const names = useMemo(
    () => (campaign?.entities || []).filter((e) => NAME_TYPES.includes(e.type)).map((e) => e.title),
    [campaign?.entities],
  )

  useEffect(() => {
    let cancelled = false
    setTranscript(undefined)
    loadTranscript(session.id)
      .then((t) => !cancelled && setTranscript(t))
      .catch((err) => !cancelled && (setTranscript(null), setError(err.message)))
    return () => {
      cancelled = true
    }
  }, [session.id, session.audioPath])

  // Keep the key list in step when the AI connection changes.
  useEffect(() => setHasKey(Boolean(getTranscribeKey())), [connection])

  async function transcribe() {
    setError(null)
    setJob({ stage: 'loading', value: 0 })
    try {
      const segments = await transcribeSession(session, { apiKey: getTranscribeKey(), names, onProgress: setJob })
      setTranscript({ segments, audioPath: session.audioPath })
    } catch (err) {
      setError(err.message)
    } finally {
      setJob(null)
    }
  }

  async function makeDraft() {
    setError(null)
    setDraft('working')
    try {
      setDraft(await draftRecap({ title: session.title, segments: transcript.segments, marks: session.audioMarks, names }))
    } catch (err) {
      setDraft(null)
      setError(err.message)
    }
  }

  async function addDraft() {
    const { error: saveError } = await supabase
      .from('session_notes')
      .update({ notes: appendDraftToNotes(session.notes, draft) })
      .eq('id', session.id)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setDraft(null)
    onChanged?.()
  }

  async function remove() {
    if (!window.confirm('Remove this transcript? You can transcribe the recording again later (OpenAI charges again).')) return
    try {
      await removeTranscript(session.id)
      setTranscript(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function saveKey(event) {
    event.preventDefault()
    if (!keyDraft.trim()) return
    saveTranscribeKey(keyDraft)
    setKeyDraft('')
    setHasKey(true)
  }

  const q = query.trim().toLowerCase()
  const segments = transcript?.segments || []
  const current = segmentAt(segments, position)
  const rows = useMemo(() => {
    const marks = (session.audioMarks || []).map((m) => ({ kind: 'mark', t: m.t, label: m.label }))
    const lines = segments.map((s, i) => ({ kind: 'line', t: s.start, index: i, text: s.text }))
    const all = [...lines, ...marks].sort((a, b) => a.t - b.t || (a.kind === 'mark' ? -1 : 1))
    return q ? all.filter((r) => r.kind === 'line' && r.text.toLowerCase().includes(q)) : all
  }, [segments, session.audioMarks, q])

  const cost = estimateCost(session.audioSeconds)
  const usingOwnKey = connection?.provider === 'openai'

  return (
    <section className="transcript" aria-label="Transcript">
      <h4 className="transcript__title">
        <Icon name="scroll" /> Transcript
      </h4>

      {transcript === undefined ? (
        <p className="transcript__hint">Loading…</p>
      ) : job ? (
        <div className="transcript__job" role="status">
          <span>
            {STAGES[job.stage]}
            {job.value != null ? `… ${Math.round(job.value * 100)}%` : '…'}
          </span>
          <span className="transcript__job-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((job.value || 0) * 100)}%` }} />
          </span>
          <span className="transcript__hint">Keep this page open. Long sessions take a few minutes.</span>
        </div>
      ) : !transcript ? (
        <div className="transcript__empty">
          <p className="transcript__hint">
            Turn the recording into searchable text, then draft the recap from it.
            {cost != null && ` About $${cost.toFixed(2)} on your OpenAI account (Whisper, $0.006 a minute).`}
          </p>
          {hasKey ? (
            <div className="transcript__actions">
              <button type="button" className="btn btn--primary" onClick={transcribe}>
                <Icon name="scroll" /> Transcribe recording
              </button>
              {!usingOwnKey && (
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => {
                    saveTranscribeKey(null)
                    setHasKey(Boolean(getTranscribeKey()))
                  }}
                >
                  Forget OpenAI key
                </button>
              )}
            </div>
          ) : (
            <form className="transcript__key" onSubmit={saveKey}>
              <label htmlFor={`transcribe-key-${session.id}`}>
                Transcribing uses an OpenAI API key (Claude can’t listen to audio). It stays on this device.
              </label>
              <div className="transcript__key-row">
                <input
                  id={`transcribe-key-${session.id}`}
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                />
                <button type="submit" className="btn" disabled={!keyDraft.trim()}>
                  Save key
                </button>
              </div>
              <a className="transcript__hint" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                Get a key at platform.openai.com
              </a>
            </form>
          )}
        </div>
      ) : (
        <>
          <div className="transcript__toolbar">
            <input
              type="search"
              className="transcript__search"
              placeholder="Search the transcript"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the transcript"
            />
            <button type="button" className="btn btn--primary" onClick={makeDraft} disabled={draft === 'working'}>
              <Icon name="feather" /> {draft === 'working' ? 'Drafting…' : 'Draft recap'}
            </button>
          </div>
          {q && (
            <p className="transcript__hint">
              {rows.length} line{rows.length === 1 ? '' : 's'} mention “{query.trim()}”
            </p>
          )}
          <ol className="transcript__lines">
            {rows.map((r) =>
              r.kind === 'mark' ? (
                <li key={`m-${r.t}-${r.label}`} className="transcript__mark">
                  <button type="button" onClick={() => player.current?.seek(r.t, true)}>
                    <Icon name="bookmark" /> {clock(r.t)} · {r.label || 'Bookmark'}
                  </button>
                </li>
              ) : (
                <li key={r.index} className={`transcript__line${r.index === current ? ' is-current' : ''}`}>
                  <button
                    type="button"
                    className="transcript__time"
                    onClick={() => player.current?.seek(r.t, true)}
                    aria-label={`Play from ${clock(r.t)}`}
                  >
                    {clock(r.t)}
                  </button>
                  <span className="transcript__text">
                    <Highlighted text={r.text} query={q} />
                  </span>
                </li>
              ),
            )}
          </ol>
          <div className="transcript__actions">
            <button
              type="button"
              className="btn btn--text"
              onClick={() =>
                downloadFile(
                  `${safeFileName(session.title || 'session')}-transcript.txt`,
                  transcriptText(segments),
                  'text/plain;charset=utf-8',
                )
              }
            >
              <Icon name="download" /> Download text
            </button>
            <button type="button" className="btn btn--text transcript__remove" onClick={remove}>
              <Icon name="trash" /> Remove transcript
            </button>
          </div>
        </>
      )}

      {error && <p className="field-error">{error}</p>}

      {draft && draft !== 'working' && (
        <Modal onClose={() => setDraft(null)} label="Recap draft">
          <div className="transcript-draft form-stack">
            <h3 className="section-card__title">
              <Icon name="feather" /> Recap draft
            </h3>
            <p className="transcript__hint">Drafted from the transcript. Check it over — it’s added after your recap, where you can edit it.</p>
            <div className="transcript-draft__body">
              {draft.recap.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {draft.highlights.length > 0 && (
                <ul>
                  {draft.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={() => setDraft(null)}>
                Discard
              </button>
              <button type="button" className="btn btn--primary" onClick={addDraft}>
                Add to recap
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default SessionTranscript
