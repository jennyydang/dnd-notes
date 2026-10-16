import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, removeImage } from '../lib/storage.js'
import { AUDIO_BUCKET, formatDuration } from '../lib/sessionRecorder.js'
import SessionAudio from './SessionAudio.jsx'
import AudioDoodle from './AudioDoodle.jsx'
import { formatSessionDate, sortSessionsByDate } from '../lib/sessionNotes.js'
import { extractMentions, notesToPlainText } from '../lib/richNotes.js'
import { TAG_GROUPS } from '../lib/tags.js'
import Modal from './Modal.jsx'
import { confirmDelete } from '../lib/confirm.js'
import SessionNoteForm from './SessionNoteForm.jsx'
import ExportNotesDialog from './ExportNotesDialog.jsx'
import { RichNotesView } from './RichNotesEditor.jsx'
import Icon from './Icon.jsx'
import './SessionNotesTab.scss'

const PARTY_BUCKET = 'party-portraits'

const emptyForm = { title: '', sessionDate: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  sessionDate: r.session_date,
  notes: r.notes,
  createdAt: r.created_at,
  audioPath: r.audio_path || null,
  audioSeconds: r.audio_seconds ?? null,
  audioDoodle: Array.isArray(r.audio_doodle) ? r.audio_doodle : null,
})

const partyFromRow = (r) => ({
  id: r.id,
  name: r.name,
  photo: getPublicUrl(PARTY_BUCKET, r.photo_path),
})

// The party roster isn't tracked per-session (there's no "who attended"
// data), so this just shows the campaign's current party as a handy
// reference alongside the recap rather than claiming to be session-scoped.
function SessionPartyPanel({ campaignId }) {
  const { items: party, loading } = useSupabaseTable('party_members', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })

  if (loading || party.length === 0) return null

  return (
    <aside className="session-detail__party panel">
      <h4>Party</h4>
      <ul className="session-detail__party-list">
        {party.map((member) => (
          <li key={member.id} className="session-detail__party-member">
            {member.photo ? (
              <img src={member.photo} alt="" />
            ) : (
              <span className="session-detail__party-fallback" aria-hidden="true">
                {member.name?.[0]?.toUpperCase() || '?'}
              </span>
            )}
            <span>{member.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

const MENTION_SECTIONS = [
  { group: 'person', title: 'People Met', tabLabel: 'NPCs' },
  { group: 'place', title: 'Places Visited', tabLabel: 'Maps' },
  { group: 'lore', title: 'Lore', tabLabel: 'Lore' },
  { group: 'loot', title: 'Loot Found', tabLabel: 'Loot' },
  { group: 'event', title: 'Events', tabLabel: 'Timeline' },
]

// Everything tagged in this recap (@ / # / ~ / $), as links over to the
// tab where each one's card lives.
function SessionMentionsPanel({ notes, onOpenTab }) {
  const mentions = useMemo(() => extractMentions(notes), [notes])
  const sections = MENTION_SECTIONS.filter(({ group }) => mentions[group].length > 0)
  if (sections.length === 0) return null

  return (
    <aside className="session-detail__mentions panel">
      {sections.map(({ group, title, tabLabel }) => (
        <section key={group}>
          <h4>{title}</h4>
          <ul className="session-detail__mention-list">
            {mentions[group].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`mention mention--${group} session-detail__mention`}
                  onClick={() => onOpenTab?.(TAG_GROUPS[group].tab)}
                  title={`Open the ${tabLabel} tab`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  )
}

function SessionNotesTab({ campaignId, campaignName, playerId, onOpenTab, addRequest }) {
  // Session notes are personal — scoped to this player within the
  // campaign, not shared like every other tab. Admin has no playerId
  // (isn't a player account), so it falls back to seeing every note in
  // the campaign rather than being scoped to nobody.
  const filters = playerId
    ? { campaign_id: campaignId, player_id: playerId }
    : { campaign_id: campaignId }

  const { items: sessions, loading, error, addItem, updateItem, removeItem, refetch } =
    useSupabaseTable('session_notes', {
      fromRow,
      orderBy: 'session_date',
      ascending: false,
      filters,
    })
  const sortedSessions = useMemo(() => sortSessionsByDate(sessions), [sessions])

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  // What the Export dialog is for: 'all', or one session's id.
  const [exportTarget, setExportTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  // Saving waits on the insert plus a refetch, which can take a second or
  // two — long enough to click Save (or hit Enter) again. The ref blocks a
  // second submit immediately, before React has re-rendered the disabled
  // button; without it each extra submit inserted a duplicate note.
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  function startAdding() {
    setViewingId(null)
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(session) {
    setForm({
      title: session.title,
      sessionDate: session.sessionDate,
      notes: session.notes,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(session.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (submittingRef.current) return
    if (!form.notes.trim()) {
      setFormError('Write something in the recap first.')
      return
    }

    const payload = {
      title: form.title,
      session_date: form.sessionDate,
      notes: form.notes,
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Home's "Session recap" quick action lands here with the Add form open.
  useEffect(() => {
    if (addRequest) startAdding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRequest])

  async function removeSession(id) {
    const session = sessions.find((s) => s.id === id)
    if (!confirmDelete(`the session “${session?.title || 'Untitled Session'}”`)) return
    await removeItem(id)
    if (session?.audioPath) await removeImage(AUDIO_BUCKET, session.audioPath)
    if (editingId === id) cancelForm()
    if (viewingId === id) setViewingId(null)
  }

  function renderSessionForm() {
    return (
      <SessionNoteForm
        idPrefix="session"
        campaignId={campaignId}
        form={form}
        setForm={setForm}
        onSubmit={submitForm}
        formError={formError}
        onCancel={cancelForm}
        onDelete={editingId ? () => removeSession(editingId) : undefined}
        submitting={submitting}
        submitLabel={submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Session Notes'}
      />
    )
  }

  const viewingSession = sortedSessions.find((s) => s.id === viewingId) || null

  return (
    <section className="session-notes-tab">
      <div className="session-notes-tab__toolbar">
        <div className="session-notes-tab__toolbar-left">
          {viewingSession && (
            <button type="button" className="btn btn--text" onClick={() => setViewingId(null)}>
              &larr; All Sessions
            </button>
          )}
        </div>
        <div className="session-notes-tab__toolbar-right">
          {sortedSessions.length > 1 && !viewingSession && (
            <button type="button" className="btn" onClick={() => setExportTarget('all')}>
              <Icon name="download" /> Export all
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={startAdding}>
            + Add Session Notes
          </button>
        </div>
      </div>

      {exportTarget && (
        <ExportNotesDialog
          sessions={exportTarget === 'all' ? sortedSessions : sortedSessions.filter((s) => s.id === exportTarget)}
          campaignName={campaignName}
          onClose={() => setExportTarget(null)}
        />
      )}

      {isAdding && (
        <Modal onClose={cancelForm} label="Add Session Notes">
          {renderSessionForm()}
        </Modal>
      )}

      {editingId && (
        <Modal onClose={cancelForm} label="Edit Session Notes">
          {renderSessionForm()}
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && sortedSessions.length === 0 && !isAdding && (
        <p className="empty-state">
          No session notes yet. These are personal to you — log a recap
          after each game to keep track of what happened.
        </p>
      )}

      {!loading && !error && viewingSession && (
        <div className="session-detail">
          <article className="session-detail__card panel">
            <div className="session-detail__header">
              <span className="session-detail__badge" aria-hidden="true">
                <Icon name="scroll" />
              </span>
              <h3 className="session-detail__title">
                {viewingSession.title || 'Untitled Session'}
              </h3>
              {viewingSession.sessionDate && (
                <span className="session-detail__date">
                  <Icon name="calendar" /> {formatSessionDate(viewingSession.sessionDate)}
                </span>
              )}
            </div>
            <div className="session-detail__divider" aria-hidden="true">
              ◆
            </div>
            <RichNotesView value={viewingSession.notes} className="session-detail__notes" />
            <SessionAudio session={viewingSession} onChanged={() => refetch({ silent: true })} />
            <div className="session-detail__actions">
              <button type="button" className="btn btn--text" onClick={() => setExportTarget(viewingSession.id)}>
                Export
              </button>
              <button type="button" className="btn btn--text" onClick={() => startEditing(viewingSession)}>
                Edit
              </button>
            </div>
          </article>

          <div className="session-detail__side">
            <SessionMentionsPanel notes={viewingSession.notes} onOpenTab={onOpenTab} />
            <SessionPartyPanel campaignId={campaignId} />
          </div>
        </div>
      )}

      {!loading && !error && !viewingSession && sortedSessions.length > 0 && (
        <div className="session-list">
          {sortedSessions.map((session) => (
            <article className="session-card panel" key={session.id}>
              <span className="session-card__badge" aria-hidden="true">
                <Icon name="scroll" />
              </span>
              <div className="session-card__body">
                <div className="session-card__main">
                  <button
                    type="button"
                    className="session-card__title"
                    onClick={() => setViewingId(session.id)}
                  >
                    {session.title || 'Untitled Session'}
                  </button>
                  {session.sessionDate && (
                    <span className="session-card__date">{formatSessionDate(session.sessionDate)}</span>
                  )}
                  {session.audioPath && (
                    <span className="session-card__audio" title="Has a recording">
                      <Icon name="mic" />
                      {session.audioSeconds ? formatDuration(session.audioSeconds) : 'Audio'}
                    </span>
                  )}
                </div>
                {session.audioDoodle && (
                  <AudioDoodle doodle={session.audioDoodle} compact label="Recording doodle" />
                )}
                <p className="session-card__notes">{notesToPlainText(session.notes)}</p>
                <div className="session-card__actions">
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => setExportTarget(session.id)}
                    aria-label={`Export ${session.title || 'Untitled Session'}`}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => startEditing(session)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default SessionNotesTab
