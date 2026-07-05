import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import './NpcsTab.scss'

const LIFE_STATUSES = ['Alive', 'Deceased', 'Unknown', 'Missing']

const emptyForm = { name: '', race: '', metAt: '', status: 'Alive' }

function NpcsTab() {
  const [npcs, setNpcs] = useLocalStorage('dnd-notes-npcs', [])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setIsAdding(true)
  }

  function startEditing(npc) {
    setForm({ name: npc.name, race: npc.race, metAt: npc.metAt, status: npc.status })
    setIsAdding(false)
    setEditingId(npc.id)
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
      setNpcs((prev) =>
        prev.map((n) => (n.id === editingId ? { ...n, ...form } : n)),
      )
    } else {
      setNpcs((prev) => [...prev, { id: crypto.randomUUID(), ...form }])
    }
    cancelForm()
  }

  function removeNpc(id) {
    setNpcs((prev) => prev.filter((n) => n.id !== id))
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="npcs-tab">
      <div className="npcs-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add NPC
        </button>
      </div>

      {showForm && (
        <form className="npc-form panel" onSubmit={submitForm}>
          <div className="npc-form__grid">
            <div className="field">
              <label htmlFor="npc-name">Name</label>
              <input
                id="npc-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Elandra Voss"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="npc-race">Race</label>
              <input
                id="npc-race"
                type="text"
                value={form.race}
                onChange={(e) => setForm({ ...form, race: e.target.value })}
                placeholder="Half-elf"
              />
            </div>
            <div className="field">
              <label htmlFor="npc-met">Where we met them</label>
              <input
                id="npc-met"
                type="text"
                value={form.metAt}
                onChange={(e) => setForm({ ...form, metAt: e.target.value })}
                placeholder="The Rusty Tankard, Waterdeep"
              />
            </div>
            <div className="field">
              <label htmlFor="npc-status">Life status</label>
              <select
                id="npc-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {LIFE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="npc-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add NPC'}
            </button>
          </div>
        </form>
      )}

      {npcs.length === 0 ? (
        <p className="empty-state">
          No NPCs recorded yet. Add the folks your party has met along the way.
        </p>
      ) : (
        <div className="npc-list">
          {npcs.map((npc) => (
            <article className="npc-card panel" key={npc.id}>
              <div className="npc-card__main">
                <h3 className="npc-card__name">{npc.name}</h3>
                <span
                  className={`status-badge status-badge--${npc.status.toLowerCase()}`}
                >
                  {npc.status}
                </span>
              </div>
              <dl className="npc-card__details">
                <div>
                  <dt>Race</dt>
                  <dd>{npc.race || '—'}</dd>
                </div>
                <div>
                  <dt>Where we met them</dt>
                  <dd>{npc.metAt || '—'}</dd>
                </div>
              </dl>
              <div className="npc-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(npc)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeNpc(npc.id)}
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

export default NpcsTab
