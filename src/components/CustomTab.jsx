import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './CustomTab.scss'

const emptyForm = { title: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
})

function CustomTab({ tabId, tabName, onRename, onDelete }) {
  const { items: entries, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('custom_tab_entries', {
      fromRow,
      filters: { custom_tab_id: tabId },
    })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(tabName)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(entry) {
    setForm({ title: entry.title, notes: entry.notes })
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

    const payload = { title: form.title, notes: form.notes }

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

  function startRenaming() {
    setNameDraft(tabName)
    setIsRenaming(true)
  }

  function submitRename(event) {
    event.preventDefault()
    if (!nameDraft.trim()) return
    onRename(nameDraft)
    setIsRenaming(false)
  }

  function confirmDeleteTab() {
    const confirmed = window.confirm(
      `Delete the "${tabName}" tab and everything in it? This can't be undone.`,
    )
    if (confirmed) onDelete()
  }

  function renderEntryForm(standalone) {
    return (
    <form className={`custom-entry-form panel${standalone ? ' custom-entry-form--standalone' : ''}`} onSubmit={submitForm}>
      <div className="field">
        <label htmlFor="custom-entry-title">Title</label>
        <input
          id="custom-entry-title"
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Entry title"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="custom-entry-notes">Notes</label>
        <textarea
          id="custom-entry-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Write your notes here..."
        />
      </div>
      {formError && <p className="empty-state empty-state--error">{formError}</p>}
      <div className="custom-entry-form__actions">
        <button type="button" className="btn btn--text" onClick={cancelForm}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {editingId ? 'Save Changes' : 'Add Entry'}
        </button>
      </div>
    </form>
    )
  }

  return (
    <section className="custom-tab">
      <div className="custom-tab__toolbar">
        {isRenaming ? (
          <form className="custom-tab__rename" onSubmit={submitRename}>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              aria-label="Tab name"
              autoFocus
            />
            <button type="submit" className="btn btn--primary">
              Save
            </button>
            <button
              type="button"
              className="btn btn--text"
              onClick={() => setIsRenaming(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="custom-tab__tab-actions">
            <button type="button" className="btn btn--text" onClick={startRenaming}>
              Rename Tab
            </button>
            <button type="button" className="btn btn--danger" onClick={confirmDeleteTab}>
              Delete Tab
            </button>
          </div>
        )}
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Entry
        </button>
      </div>

      {isAdding && renderEntryForm(true)}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="empty-state">No entries yet in this tab.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="custom-entry-list">
          {entries.map((entry) =>
            editingId === entry.id ? (
              <div className="custom-entry-list__edit-slot" key={entry.id}>
                {renderEntryForm(false)}
              </div>
            ) : (
              <article className="custom-entry-card panel" key={entry.id}>
                <h3 className="custom-entry-card__title">{entry.title}</h3>
                {entry.notes && <p className="custom-entry-card__notes">{entry.notes}</p>}
                <div className="custom-entry-card__actions">
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
            ),
          )}
        </div>
      )}
    </section>
  )
}

export default CustomTab
