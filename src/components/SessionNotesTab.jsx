import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl } from '../lib/storage.js'
import { formatSessionDate, sortSessionsByDate } from '../lib/sessionNotes.js'
import Modal from './Modal.jsx'
import SessionNoteForm from './SessionNoteForm.jsx'
import './SessionNotesTab.scss'

const PARTY_BUCKET = 'party-portraits'

const emptyForm = { title: '', sessionDate: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  sessionDate: r.session_date,
  notes: r.notes,
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

function SessionNotesTab({ campaignId, playerId }) {
  // Session notes are personal — scoped to this player within the
  // campaign, not shared like every other tab. Admin has no playerId
  // (isn't a player account), so it falls back to seeing every note in
  // the campaign rather than being scoped to nobody.
  const filters = playerId
    ? { campaign_id: campaignId, player_id: playerId }
    : { campaign_id: campaignId }

  const { items: sessions, loading, error, addItem, updateItem, removeItem } =
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
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

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
    if (!form.notes.trim()) return

    const payload = {
      title: form.title,
      session_date: form.sessionDate,
      notes: form.notes,
    }

    try {
      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function removeSession(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
    if (viewingId === id) setViewingId(null)
  }

  function renderSessionForm() {
    return (
      <SessionNoteForm
        idPrefix="session"
        form={form}
        setForm={setForm}
        onSubmit={submitForm}
        formError={formError}
        onCancel={cancelForm}
        submitLabel={editingId ? 'Save Changes' : 'Add Session Notes'}
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
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Session Notes
        </button>
      </div>

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
                📜
              </span>
              <h3 className="session-detail__title">
                {viewingSession.title || 'Untitled Session'}
              </h3>
              {viewingSession.sessionDate && (
                <span className="session-detail__date">
                  <span aria-hidden="true">📅</span> {formatSessionDate(viewingSession.sessionDate)}
                </span>
              )}
            </div>
            <div className="session-detail__divider" aria-hidden="true">
              ◆
            </div>
            <p className="session-detail__notes">{viewingSession.notes}</p>
            <div className="session-detail__actions">
              <button type="button" className="btn btn--text" onClick={() => startEditing(viewingSession)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => removeSession(viewingSession.id)}
              >
                Delete
              </button>
            </div>
          </article>

          <SessionPartyPanel campaignId={campaignId} />
        </div>
      )}

      {!loading && !error && !viewingSession && sortedSessions.length > 0 && (
        <div className="session-list">
          {sortedSessions.map((session) => (
            <article className="session-card panel" key={session.id}>
              <span className="session-card__badge" aria-hidden="true">
                📜
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
                </div>
                <p className="session-card__notes">{session.notes}</p>
                <div className="session-card__actions">
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => startEditing(session)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => removeSession(session.id)}
                  >
                    Delete
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
