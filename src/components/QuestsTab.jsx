import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import './QuestsTab.scss'

const QUEST_STATUSES = ['Active', 'Completed', 'Failed']

const emptyForm = { name: '', status: 'Active', givenBy: '', notes: '' }

function QuestsTab() {
  const [quests, setQuests] = useLocalStorage('dnd-notes-quests', [])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setIsAdding(true)
  }

  function startEditing(quest) {
    setForm({
      name: quest.name,
      status: quest.status,
      givenBy: quest.givenBy,
      notes: quest.notes,
    })
    setIsAdding(false)
    setEditingId(quest.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    if (editingId) {
      setQuests((prev) =>
        prev.map((q) => (q.id === editingId ? { ...q, ...form } : q)),
      )
    } else {
      setQuests((prev) => [...prev, { id: crypto.randomUUID(), ...form }])
    }
    cancelForm()
  }

  function removeQuest(id) {
    setQuests((prev) => prev.filter((q) => q.id !== id))
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="quests-tab">
      <div className="quests-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Quest
        </button>
      </div>

      {showForm && (
        <form className="quest-form panel" onSubmit={submitForm}>
          <div className="quest-form__grid">
            <div className="field">
              <label htmlFor="quest-name">Quest</label>
              <input
                id="quest-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Clear the Sunken Crypt"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quest-given-by">Given by</label>
              <input
                id="quest-given-by"
                type="text"
                value={form.givenBy}
                onChange={(e) => setForm({ ...form, givenBy: e.target.value })}
                placeholder="Mayor Alderin"
              />
            </div>
            <div className="field">
              <label htmlFor="quest-status">Status</label>
              <select
                id="quest-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {QUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="quest-notes">Notes</label>
            <textarea
              id="quest-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Rumored to be guarded by an undead knight..."
            />
          </div>
          <div className="quest-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Quest'}
            </button>
          </div>
        </form>
      )}

      {quests.length === 0 ? (
        <p className="empty-state">
          No quests logged yet. Track what your party is working towards.
        </p>
      ) : (
        <div className="quest-list">
          {quests.map((quest) => (
            <article className="quest-card panel" key={quest.id}>
              <div className="quest-card__main">
                <h3 className="quest-card__name">{quest.name}</h3>
                <span
                  className={`status-badge status-badge--${quest.status.toLowerCase()}`}
                >
                  {quest.status}
                </span>
              </div>
              {quest.givenBy && (
                <p className="quest-card__given-by">Given by {quest.givenBy}</p>
              )}
              {quest.notes && <p className="quest-card__notes">{quest.notes}</p>}
              <div className="quest-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(quest)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeQuest(quest.id)}
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

export default QuestsTab
