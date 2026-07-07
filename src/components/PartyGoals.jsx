import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './PartyGoals.scss'

const GOAL_STATUSES = ['Active', 'Completed']

const emptyForm = { title: '', status: 'Active', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  status: r.status,
  notes: r.notes,
})

function PartyGoals({ campaignId }) {
  const { items: goals, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('party_goals', { fromRow, filters: { campaign_id: campaignId } })
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

  function startEditing(goal) {
    setForm({ title: goal.title, status: goal.status, notes: goal.notes })
    setIsAdding(false)
    setFormError(null)
    setEditingId(goal.id)
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
      status: form.status,
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

  async function removeGoal(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="party-goals">
      <h3 className="party-goals__title">Party Goals</h3>
      <div className="party-goals__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Party Goal
        </button>
      </div>

      {showForm && (
        <form className="goal-form panel" onSubmit={submitForm}>
          <div className="goal-form__grid">
            <div className="field">
              <label htmlFor="goal-title">Goal</label>
              <input
                id="goal-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Buy a ship of our own"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="goal-status">Status</label>
              <select
                id="goal-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {GOAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="goal-notes">Notes</label>
            <textarea
              id="goal-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Why we want this, and how close we are..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="goal-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Party Goal'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && goals.length === 0 && (
        <p className="empty-state">
          No party goals yet. These are things the party as a whole wants,
          separate from quests handed to you by NPCs.
        </p>
      )}

      {!loading && !error && goals.length > 0 && (
        <div className="goal-list">
          {goals.map((goal) => (
            <article className="goal-card panel" key={goal.id}>
              <div className="goal-card__main">
                <h4 className="goal-card__title">{goal.title}</h4>
                <span className={`status-badge status-badge--${goal.status.toLowerCase()}`}>
                  {goal.status}
                </span>
              </div>
              {goal.notes && <p className="goal-card__notes">{goal.notes}</p>}
              <div className="goal-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(goal)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeGoal(goal.id)}
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

export default PartyGoals
