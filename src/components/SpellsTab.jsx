import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import TabNav from './TabNav.jsx'
import './SpellsTab.scss'

const SPELL_VIEWS = [
  { id: 'cantrips', label: 'Cantrips' },
  { id: 'spells', label: 'Spells' },
]

const emptyForm = {
  name: '',
  level: 0,
  castingTime: '',
  range: '',
  components: '',
  duration: '',
  effect: '',
  details: '',
  flavor: '',
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  level: r.level,
  castingTime: r.casting_time,
  range: r.range,
  components: r.components,
  duration: r.duration,
  effect: r.effect,
  details: r.details,
  flavor: r.flavor,
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
  const [view, setView] = useState('spells')
  const [flavorSpell, setFlavorSpell] = useState(null)

  const myLevel = playerId ? party.find((m) => m.claimedBy === playerId)?.level : undefined

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(spell) {
    setForm({
      name: spell.name,
      level: spell.level,
      castingTime: spell.castingTime,
      range: spell.range,
      components: spell.components,
      duration: spell.duration,
      effect: spell.effect,
      details: spell.details,
      flavor: spell.flavor,
    })
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
      casting_time: form.castingTime,
      range: form.range,
      components: form.components,
      duration: form.duration,
      effect: form.effect,
      details: form.details,
      flavor: form.flavor,
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
    if (flavorSpell?.id === id) setFlavorSpell(null)
  }

  function renderSpellForm(standalone) {
    return (
    <form className={`spell-form panel${standalone ? ' spell-form--standalone' : ''}`} onSubmit={submitForm}>
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
      <div className="spell-form__grid">
        <div className="field">
          <label htmlFor="spell-casting-time">Casting Time</label>
          <input
            id="spell-casting-time"
            type="text"
            value={form.castingTime}
            onChange={(e) => setForm({ ...form, castingTime: e.target.value })}
            placeholder="1 action"
          />
        </div>
        <div className="field">
          <label htmlFor="spell-range">Range</label>
          <input
            id="spell-range"
            type="text"
            value={form.range}
            onChange={(e) => setForm({ ...form, range: e.target.value })}
            placeholder="150 feet"
          />
        </div>
        <div className="field">
          <label htmlFor="spell-components">Components</label>
          <input
            id="spell-components"
            type="text"
            value={form.components}
            onChange={(e) => setForm({ ...form, components: e.target.value })}
            placeholder="V, S, M (a tiny ball of bat guano and sulfur)"
          />
        </div>
        <div className="field">
          <label htmlFor="spell-duration">Duration</label>
          <input
            id="spell-duration"
            type="text"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="Instantaneous"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="spell-effect">Effect</label>
        <textarea
          id="spell-effect"
          value={form.effect}
          onChange={(e) => setForm({ ...form, effect: e.target.value })}
          placeholder="Deals 8d6 fire damage in a 20-foot radius; Dexterity save for half, and any effects at higher levels..."
        />
      </div>
      <div className="field">
        <label htmlFor="spell-details">Description</label>
        <textarea
          id="spell-details"
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
          placeholder="A short reminder for how you play it..."
        />
      </div>
      <div className="field">
        <label htmlFor="spell-flavor">Flavor</label>
        <textarea
          id="spell-flavor"
          value={form.flavor}
          onChange={(e) => setForm({ ...form, flavor: e.target.value })}
          placeholder="Read-aloud text, lore, or flourishes — shown in the flavor-text popup..."
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
    )
  }

  const levelsInView = view === 'cantrips' ? [0] : Array.from({ length: 9 }, (_, i) => i + 1)
  const sections = []
  for (const level of levelsInView) {
    const spellsAtLevel = spells.filter((s) => s.level === level)
    if (spellsAtLevel.length > 0) sections.push({ level, spells: spellsAtLevel })
  }
  // Keep an in-progress edit visible even if the Cantrips/Spells toggle
  // flips away from the spell's own level mid-edit, rather than yanking
  // the open form out from under whoever's using it.
  const editingSpell = spells.find((s) => s.id === editingId)
  if (editingSpell && !levelsInView.includes(editingSpell.level)) {
    sections.unshift({ level: editingSpell.level, spells: [editingSpell] })
  }

  return (
    <section className="spells-tab">
      <div className="spells-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Spell
        </button>
      </div>

      <TabNav
        tabs={SPELL_VIEWS}
        activeTab={view}
        onSelect={setView}
        className="tab-nav--pill"
        label="Spell level filter"
      />

      {playerId && myLevel === undefined && (
        <p className="empty-state">
          Claim your character in the Party tab to see which spells are
          available at your level.
        </p>
      )}

      {isAdding && renderSpellForm(true)}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && sections.length === 0 && (
        <p className="empty-state">
          {view === 'cantrips'
            ? 'No cantrips recorded yet.'
            : 'No spells recorded yet.'}{' '}
          These are personal to you — add the spells your character knows.
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
                {spellsAtLevel.map((spell) => {
                  const meta = [
                    spell.castingTime && `Casting Time: ${spell.castingTime}`,
                    spell.range && `Range: ${spell.range}`,
                    spell.components && `Components: ${spell.components}`,
                    spell.duration && `Duration: ${spell.duration}`,
                  ].filter(Boolean)

                  if (editingId === spell.id) {
                    return (
                      <div className="spell-list__edit-slot" key={spell.id}>
                        {renderSpellForm(false)}
                      </div>
                    )
                  }

                  return (
                    <article
                      className={`spell-card panel${isLocked ? ' spell-card--locked' : ''}`}
                      key={spell.id}
                    >
                      <div className="spell-card__main">
                        <h4 className="spell-card__name">{spell.name}</h4>
                        <div className="spell-card__main-right">
                          {isLocked && <span className="spell-card__badge">Locked</span>}
                          <button
                            type="button"
                            className="spell-card__flavor-btn"
                            onClick={() => setFlavorSpell(spell)}
                            aria-label={`View flavor text for ${spell.name}`}
                            title="Flavor text"
                          >
                            🔥
                          </button>
                        </div>
                      </div>
                      <div className="spell-card__body">
                        {meta.length > 0 && (
                          <ul className="spell-card__meta">
                            {meta.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        )}
                        {spell.effect && <p className="spell-card__effect">{spell.effect}</p>}
                        {spell.details && <p className="spell-card__details">{spell.details}</p>}
                      </div>
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
                  )
                })}
              </div>
            </div>
          )
        })}

      {flavorSpell && (
        <div
          className="spell-flavor-modal__backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spell-flavor-modal-title"
          onClick={() => setFlavorSpell(null)}
        >
          <div className="spell-flavor-modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="spell-flavor-modal__header">
              <h3 id="spell-flavor-modal-title">{flavorSpell.name}</h3>
              <button
                type="button"
                className="spell-flavor-modal__close"
                onClick={() => setFlavorSpell(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p className="spell-flavor-modal__text">
              {flavorSpell.flavor || 'No flavor text recorded yet.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default SpellsTab
