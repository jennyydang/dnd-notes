import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { confirmDelete } from '../lib/confirm.js'
import TabNav from './TabNav.jsx'
import Modal from './Modal.jsx'
import './CreaturesTab.scss'

const KINDS = ['Monster', 'Creature']

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Monster', label: 'Monsters' },
  { id: 'Creature', label: 'Creatures' },
]

// The standard 5e creature types, offered as suggestions (free text is fine).
const CREATURE_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey',
  'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead',
]

const emptyForm = {
  name: '',
  kind: 'Monster',
  creatureType: '',
  challenge: '',
  armorClass: '',
  hitPoints: '',
  encounteredAt: '',
  notes: '',
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  creatureType: r.creature_type,
  challenge: r.challenge,
  armorClass: r.armor_class,
  hitPoints: r.hit_points,
  encounteredAt: r.encountered_at,
  notes: r.notes,
  createdAt: r.created_at,
})

// Whole numbers only; blank means "unknown" (stored as null).
function parseStat(value, max) {
  if (String(value).trim() === '') return { value: null }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > max) return { error: `Use a whole number from 0 to ${max}.` }
  return { value: n }
}

// Monsters & creatures the party has met, shared by the whole campaign:
// any player can add, edit or remove one. A filter switches between all
// of them, just monsters, or just creatures.
function CreaturesTab({ campaignId }) {
  const { openEntity } = useCampaignNav()
  const { items: creatures, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('creatures', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const counts = useMemo(
    () => ({
      all: creatures.length,
      Monster: creatures.filter((c) => c.kind === 'Monster').length,
      Creature: creatures.filter((c) => c.kind === 'Creature').length,
    }),
    [creatures],
  )
  const visible = useMemo(
    () =>
      creatures
        .filter((c) => filter === 'all' || c.kind === filter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [creatures, filter],
  )

  function startAdding() {
    // New entries default to whichever list is being viewed.
    setForm({ ...emptyForm, kind: filter === 'Creature' ? 'Creature' : 'Monster' })
    setEditingId(null)
    setFormError(null)
    setFieldErrors({})
    setFormOpen(true)
  }

  function startEditing(creature) {
    setForm({
      name: creature.name,
      kind: creature.kind,
      creatureType: creature.creatureType,
      challenge: creature.challenge,
      armorClass: creature.armorClass ?? '',
      hitPoints: creature.hitPoints ?? '',
      encounteredAt: creature.encounteredAt,
      notes: creature.notes,
    })
    setEditingId(creature.id)
    setFormError(null)
    setFieldErrors({})
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setFieldErrors({})
  }

  async function submitForm(event) {
    event.preventDefault()
    if (saving) return
    const ac = parseStat(form.armorClass, 50)
    const hp = parseStat(form.hitPoints, 9999)
    const errors = {}
    if (!form.name.trim()) errors.name = 'Give it a name.'
    if (ac.error) errors.armorClass = ac.error
    if (hp.error) errors.hitPoints = hp.error
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      creature_type: form.creatureType.trim(),
      challenge: form.challenge.trim(),
      armor_class: ac.value,
      hit_points: hp.value,
      encountered_at: form.encounteredAt.trim(),
      notes: form.notes,
    }
    setSaving(true)
    try {
      if (editingId) await updateItem(editingId, payload)
      else await addItem(payload)
      closeForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeCreature(creature) {
    if (!confirmDelete(`“${creature.name}”`)) return
    try {
      await removeItem(creature.id)
    } catch (err) {
      window.alert(`Couldn’t delete: ${err.message}`)
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const label = filter === 'Creature' ? 'Creature' : filter === 'Monster' ? 'Monster' : 'Monster or Creature'

  return (
    <section className="creatures-tab">
      <div className="creatures-tab__toolbar">
        <TabNav
          tabs={FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
          activeTab={filter}
          onSelect={setFilter}
          className="tab-nav--pill creatures-tab__filter"
          label="Show monsters or creatures"
        />
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add {label}
        </button>
      </div>

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? `Edit ${form.kind}` : `Add ${form.kind}`}>
          <form className="creature-form form-stack" onSubmit={submitForm} noValidate>
            <h3 className="section-card__title">{editingId ? `Edit ${form.kind}` : `Add ${form.kind}`}</h3>

            <div className="chip-row" role="radiogroup" aria-label="Monster or creature">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={form.kind === kind}
                  className={`chip${form.kind === kind ? ' chip--active' : ''}`}
                  onClick={() => setForm({ ...form, kind })}
                >
                  {kind === 'Monster' ? '🐉' : '🦌'} {kind}
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="creature-name">Name</label>
                <input
                  id="creature-name"
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder={form.kind === 'Monster' ? 'Young Black Dragon' : 'Giant Owl'}
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoFocus
                />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div className="field">
                <label htmlFor="creature-type">Type</label>
                <input
                  id="creature-type"
                  type="text"
                  list="creature-type-options"
                  value={form.creatureType}
                  onChange={set('creatureType')}
                  placeholder="Beast, Undead…"
                />
                <datalist id="creature-type-options">
                  {CREATURE_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="creature-cr">Challenge (CR)</label>
                <input id="creature-cr" type="text" value={form.challenge} onChange={set('challenge')} placeholder="1/2" />
              </div>
              <div className="field">
                <label htmlFor="creature-ac">AC</label>
                <input
                  id="creature-ac"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="50"
                  value={form.armorClass}
                  onChange={set('armorClass')}
                  aria-invalid={Boolean(fieldErrors.armorClass)}
                />
                {fieldErrors.armorClass && <p className="field-error">{fieldErrors.armorClass}</p>}
              </div>
              <div className="field">
                <label htmlFor="creature-hp">HP</label>
                <input
                  id="creature-hp"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="9999"
                  value={form.hitPoints}
                  onChange={set('hitPoints')}
                  aria-invalid={Boolean(fieldErrors.hitPoints)}
                />
                {fieldErrors.hitPoints && <p className="field-error">{fieldErrors.hitPoints}</p>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="creature-where">Where we met it</label>
              <input id="creature-where" type="text" value={form.encounteredAt} onChange={set('encounteredAt')} placeholder="The Sunken Crypt" />
            </div>
            <div className="field">
              <label htmlFor="creature-notes">Notes</label>
              <textarea
                id="creature-notes"
                className="field--wide"
                rows={4}
                value={form.notes}
                onChange={set('notes')}
                placeholder="Weak to radiant damage, flees below half HP…"
              />
            </div>

            {formError && (
              <p className="field-error" role="alert">
                Couldn&apos;t save: {formError}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : `Add ${form.kind}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && (
        <p className="empty-state empty-state--error">
          {error}
          {/creatures/.test(error) && ' — run the latest supabase/schema.sql to add the Monsters & Creatures table.'}
        </p>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          {creatures.length === 0
            ? 'No monsters or creatures yet. Add the things your party has fought, befriended or fled from.'
            : `No ${filter === 'Monster' ? 'monsters' : 'creatures'} yet.`}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="creature-list">
          {visible.map((c) => (
            <article className={`creature-card panel creature-card--${c.kind.toLowerCase()}`} key={c.id}>
              <header className="creature-card__header">
                <h3 className="creature-card__name">{c.name}</h3>
                <span className={`creature-card__kind creature-card__kind--${c.kind.toLowerCase()}`}>
                  <span aria-hidden="true">{c.kind === 'Monster' ? '🐉' : '🦌'}</span> {c.kind}
                </span>
              </header>
              {(c.creatureType || c.challenge) && (
                <p className="creature-card__meta">
                  {[c.creatureType, c.challenge && `CR ${c.challenge}`].filter(Boolean).join(' · ')}
                </p>
              )}
              {(c.armorClass !== null || c.hitPoints !== null) && (
                <dl className="creature-card__stats">
                  {c.armorClass !== null && (
                    <div>
                      <dt>AC</dt>
                      <dd>{c.armorClass}</dd>
                    </div>
                  )}
                  {c.hitPoints !== null && (
                    <div>
                      <dt>HP</dt>
                      <dd>{c.hitPoints}</dd>
                    </div>
                  )}
                </dl>
              )}
              {c.encounteredAt && <p className="creature-card__where">Met: {c.encounteredAt}</p>}
              {c.notes && <p className="creature-card__notes">{c.notes}</p>}
              <div className="creature-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => openEntity('creature', c.id)}
                  aria-label={`Links and related entries for ${c.name}`}
                >
                  Links
                </button>
                <button type="button" className="btn btn--text" onClick={() => startEditing(c)}>
                  Edit
                </button>
                <button type="button" className="btn btn--danger" onClick={() => removeCreature(c)}>
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

export default CreaturesTab
