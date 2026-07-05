import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './LoreTab.scss'

const emptyForm = { title: '', category: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  notes: r.notes,
})

function LoreTab({ campaignId }) {
  const { items: entries, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('lore_entries', { fromRow, orderBy: 'title', campaignId })
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

  function startEditing(entry) {
    setForm({
      title: entry.title,
      category: entry.category,
      notes: entry.notes,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(entry.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload = {
      title: form.title,
      category: form.category,
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

  async function removeEntry(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="lore-tab">
      <div className="lore-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Lore
        </button>
      </div>

      {showForm && (
        <form className="lore-form panel" onSubmit={submitForm}>
          <div className="lore-form__grid">
            <div className="field">
              <label htmlFor="lore-title">Title</label>
              <input
                id="lore-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="The Sundering of Elarion"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="lore-category">Category</label>
              <input
                id="lore-category"
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="History / Location / Deity / Organization"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="lore-notes">Notes</label>
            <textarea
              id="lore-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Centuries ago, the kingdom of Elarion split in two after..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="lore-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Lore'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="empty-state">
          No lore recorded yet. Track the history, locations, and legends of
          your world.
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="lore-list">
          {entries.map((entry) => (
            <article className="lore-card panel" key={entry.id}>
              <div className="lore-card__main">
                <h3 className="lore-card__title">{entry.title}</h3>
                {entry.category && (
                  <span className="lore-card__category">{entry.category}</span>
                )}
              </div>
              {entry.notes && <p className="lore-card__notes">{entry.notes}</p>}
              <div className="lore-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeEntry(entry.id)}
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

export default LoreTab
