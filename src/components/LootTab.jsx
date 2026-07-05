import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './LootTab.scss'

const emptyForm = { item: '', foundAt: '', holder: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  item: r.item,
  foundAt: r.found_at,
  holder: r.holder,
  notes: r.notes,
})

function LootTab({ campaignId }) {
  const { items: loot, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('loot', { fromRow, filters: { campaign_id: campaignId } })
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
      item: entry.item,
      foundAt: entry.foundAt,
      holder: entry.holder,
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
    if (!form.item.trim()) return

    const payload = {
      item: form.item,
      found_at: form.foundAt,
      holder: form.holder,
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

  async function removeLoot(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="loot-tab">
      <div className="loot-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Loot
        </button>
      </div>

      {showForm && (
        <form className="loot-form panel" onSubmit={submitForm}>
          <div className="loot-form__grid">
            <div className="field">
              <label htmlFor="loot-item">Item</label>
              <input
                id="loot-item"
                type="text"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder="Ring of Feather Falling"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="loot-found">Where we got it</label>
              <input
                id="loot-found"
                type="text"
                value={form.foundAt}
                onChange={(e) => setForm({ ...form, foundAt: e.target.value })}
                placeholder="Chest in the Sunken Crypt"
              />
            </div>
            <div className="field">
              <label htmlFor="loot-holder">Who has it</label>
              <input
                id="loot-holder"
                type="text"
                value={form.holder}
                onChange={(e) => setForm({ ...form, holder: e.target.value })}
                placeholder="Party stash / Thessaly"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="loot-notes">Notes</label>
            <textarea
              id="loot-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Unidentified, seems to hum faintly near water..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="loot-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Loot'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && loot.length === 0 && (
        <p className="empty-state">
          No loot logged yet. Track the treasures your party has claimed.
        </p>
      )}

      {!loading && !error && loot.length > 0 && (
        <div className="loot-list">
          {loot.map((entry) => (
            <article className="loot-card panel" key={entry.id}>
              <div className="loot-card__main">
                <h3 className="loot-card__item">{entry.item}</h3>
                {entry.foundAt && (
                  <span className="loot-card__found-at">{entry.foundAt}</span>
                )}
              </div>
              {entry.holder && (
                <p className="loot-card__holder">
                  <span>Held by</span> {entry.holder}
                </p>
              )}
              {entry.notes && <p className="loot-card__notes">{entry.notes}</p>}
              <div className="loot-card__actions">
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
                  onClick={() => removeLoot(entry.id)}
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

export default LootTab
