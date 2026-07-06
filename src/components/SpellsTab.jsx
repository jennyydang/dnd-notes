import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './SpellsTab.scss'

const emptyForm = { name: '', level: 0, details: '' }

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  level: r.level,
  details: r.details,
})

const partyFromRow = (r) => ({ id: r.id, claimedBy: r.claimed_by, level: r.level })

function levelLabel(level) {
  if (level === 0) return 'Cantrips'
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level] || 'th'
  return `${level}${suffix} Level`
}

function SpellsTab({ campaignId, playerId }) {
  const { items: spells, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('spells', {
      fromRow,
      orderBy: 'level',
      filters: playerId
        ? { campaign_id: campaignId, player_id: playerId }
        : { campaign_id: campaignId },
    })
  const { items: party } = useSupabaseTable('party_members', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

  const myLevel = playerId ? party.find((m) => m.claimedBy === playerId)?.level : undefined

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(spell) {
    setForm({ name: spell.name, level: spell.level, details: spell.details })
    setIsAdding(false)
    setFormError(null)
    setEditingId(spell.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload = {
      name: form.name,
      level: Math.min(9, Math.max(0, Math.floor(Number(form.level)) || 0)),
      details: form.details,
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

  async function removeSpell(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  const sections = []
  for (let level = 0; level <= 9; level++) {
    const spellsAtLevel = spells.filter((s) => s.level === level)
    if (spellsAtLevel.length > 0) sections.push({ level, spells: spellsAtLevel })
  }

  return (
    <section className="spells-tab">
      <div className="spells-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Spell
        </button>
      </div>

      {playerId && myLevel === undefined && (
        <p className="empty-state">
          Claim your character in the Party tab to see which spells are
          available at your level.
        </p>
      )}

      {showForm && (
        <form className="spell-form panel" onSubmit={submitForm}>
          <div className="spell-form__grid">
            <div className="field">
              <label htmlFor="spell-name">Name</label>
              <input
                id="spell-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fireball"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="spell-level">Level</label>
              <select
                id="spell-level"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                {Array.from({ length: 10 }, (_, level) => (
                  <option key={level} value={level}>
                    {levelLabel(level)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="spell-details">Details</label>
            <textarea
              id="spell-details"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="Casting time, range, effect, or any reminders..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="spell-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Spell'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && sections.length === 0 && (
        <p className="empty-state">
          No spells recorded yet. These are personal to you — add the
          spells your character knows.
        </p>
      )}

      {!loading &&
        !error &&
        sections.map(({ level, spells: spellsAtLevel }) => {
          const isLocked = myLevel !== undefined && level > myLevel
          const isCurrent = myLevel !== undefined && level === myLevel
          return (
            <div
              key={level}
              className={`spells-section${isCurrent ? ' spells-section--current' : ''}`}
            >
              <h3 className="spells-section__title">
                {levelLabel(level)}
                {isCurrent && <span className="spells-section__badge">Current</span>}
              </h3>
              <div className="spell-list">
                {spellsAtLevel.map((spell) => (
                  <article
                    className={`spell-card panel${isLocked ? ' spell-card--locked' : ''}`}
                    key={spell.id}
                  >
                    <div className="spell-card__main">
                      <h4 className="spell-card__name">{spell.name}</h4>
                      {isLocked && <span className="spell-card__badge">Locked</span>}
                    </div>
                    {spell.details && <p className="spell-card__details">{spell.details}</p>}
                    <div className="spell-card__actions">
                      <button
                        type="button"
                        className="btn btn--text"
                        onClick={() => startEditing(spell)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => removeSpell(spell.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        })}
    </section>
  )
}

export default SpellsTab
