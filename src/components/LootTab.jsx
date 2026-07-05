import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import './LootTab.scss'

const emptyForm = { item: '', foundAt: '', notes: '' }

function LootTab() {
  const [loot, setLoot] = useLocalStorage('dnd-notes-loot', [])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setIsAdding(true)
  }

  function startEditing(entry) {
    setForm({ item: entry.item, foundAt: entry.foundAt, notes: entry.notes })
    setIsAdding(false)
    setEditingId(entry.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function submitForm(event) {
    event.preventDefault()
    if (!form.item.trim()) return

    if (editingId) {
      setLoot((prev) =>
        prev.map((l) => (l.id === editingId ? { ...l, ...form } : l)),
      )
    } else {
      setLoot((prev) => [...prev, { id: crypto.randomUUID(), ...form }])
    }
    cancelForm()
  }

  function removeLoot(id) {
    setLoot((prev) => prev.filter((l) => l.id !== id))
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

      {loot.length === 0 ? (
        <p className="empty-state">
          No loot logged yet. Track the treasures your party has claimed.
        </p>
      ) : (
        <div className="loot-list">
          {loot.map((entry) => (
            <article className="loot-card panel" key={entry.id}>
              <div className="loot-card__main">
                <h3 className="loot-card__item">{entry.item}</h3>
                {entry.foundAt && (
                  <span className="loot-card__found-at">{entry.foundAt}</span>
                )}
              </div>
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
