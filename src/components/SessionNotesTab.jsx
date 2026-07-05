import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './SessionNotesTab.scss'

const emptyForm = { title: '', sessionDate: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  sessionDate: r.session_date,
  notes: r.notes,
})

function SessionNotesTab() {
  const { items: sessions, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('session_notes', { fromRow, ascending: false })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

  function startAdding() {
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
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="session-notes-tab">
      <div className="session-notes-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Session Notes
        </button>
      </div>

      {showForm && (
        <form className="session-form panel" onSubmit={submitForm}>
          <div className="session-form__grid">
            <div className="field">
              <label htmlFor="session-title">Title</label>
              <input
                id="session-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Session 12: The Siege of Waterdeep"
              />
            </div>
            <div className="field">
              <label htmlFor="session-date">Date</label>
              <input
                id="session-date"
                type="text"
                value={form.sessionDate}
                onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                placeholder="March 3, 2026"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="session-notes">Recap</label>
            <textarea
              id="session-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="The party arrived at the gates of Waterdeep and..."
              required
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="session-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Session Notes'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <p className="empty-state">
          No session notes yet. Log a recap after each game to keep track of
          what happened.
        </p>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="session-list">
          {sessions.map((session) => (
            <article className="session-card panel" key={session.id}>
              <div className="session-card__main">
                <h3 className="session-card__title">
                  {session.title || 'Untitled Session'}
                </h3>
                {session.sessionDate && (
                  <span className="session-card__date">{session.sessionDate}</span>
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
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default SessionNotesTab
