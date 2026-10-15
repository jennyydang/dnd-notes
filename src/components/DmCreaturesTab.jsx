import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDmShares } from '../hooks/useDmShares.js'
import { removeSharesFor, shareKey, shareWithPlayers } from '../lib/dmShares.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import ShareStatus from './ShareStatus.jsx'
import Icon from './Icon.jsx'
import './CreaturesTab.scss'
import './SecretNpcsTab.scss'
import { RichText, RichTextEditor } from './RichText.jsx'

const KINDS = ['Monster', 'Creature']
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Monster', label: 'Monsters' },
  { id: 'Creature', label: 'Creatures' },
]
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
  description: '',
  secrets: '',
  shareStats: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  creatureType: r.creature_type,
  challenge: r.challenge,
  armorClass: r.armor_class,
  hitPoints: r.hit_points,
  description: r.description,
  secrets: r.secrets,
  shareStats: r.share_stats,
  createdAt: r.created_at,
})

const partyFromRow = (r) => ({ id: r.id, dmCreatureId: r.dm_creature_id })

// Whole numbers only; blank means "unknown" (stored as null).
function parseStat(value, max) {
  if (String(value).trim() === '') return { value: null }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > max) return { error: `Use a whole number from 0 to ${max}.` }
  return { value: n }
}

const statIcon = (kind) => (kind === 'Creature' ? 'creature' : 'monster')

// The DM's private bestiary: stat out monsters and creatures ahead of
// time, then Share one when the party meets it. Players add a copy to
// their Monsters & Creatures tab — with AC/HP/CR only if the DM allows.
function DmCreaturesTab({ campaignId }) {
  const { items, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('dm_creatures', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const { items: party } = useSupabaseTable('creatures', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })
  const { byKey, revealedKeys } = useDmShares(campaignId)
  const addedIds = useMemo(() => new Set(party.map((c) => c.dmCreatureId).filter(Boolean)), [party])
  const statusOf = (c) =>
    addedIds.has(c.id) ? 'added' : byKey.has(shareKey('creature', c.id)) ? 'sent' : 'private'

  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sharingId, setSharingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const counts = {
    all: items.length,
    Monster: items.filter((c) => c.kind === 'Monster').length,
    Creature: items.filter((c) => c.kind === 'Creature').length,
  }
  const visible = items
    .filter((c) => filter === 'all' || c.kind === filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  function openForm(creature = null) {
    setForm(
      creature
        ? {
            name: creature.name,
            kind: creature.kind,
            creatureType: creature.creatureType,
            challenge: creature.challenge,
            armorClass: creature.armorClass ?? '',
            hitPoints: creature.hitPoints ?? '',
            description: creature.description,
            secrets: creature.secrets,
            shareStats: creature.shareStats,
          }
        : { ...emptyForm, kind: filter === 'Creature' ? 'Creature' : 'Monster' },
    )
    setEditingId(creature?.id || null)
    setFieldErrors({})
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
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
      description: form.description,
      secrets: form.secrets,
      share_stats: form.shareStats,
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

  async function share(c, reveal = false) {
    const what = c.shareStats ? 'name, type, description and stats (CR, AC, HP)' : 'name, type and description — not its stats'
    const message = reveal
      ? `Reveal ${c.name} to the table now?\n\nIt pops up on every player's screen and lands in their notifications. They'll see its ${what}. Never your DM notes.`
      : `Share ${c.name} with the players?\n\nEveryone gets a notification and can add it to Monsters & Creatures. They'll see its ${what}. Never your DM notes.`
    if (!window.confirm(message)) return false
    setActionError(null)
    setSharingId(c.id)
    try {
      await shareWithPlayers({
        campaignId,
        kind: 'creature',
        sourceId: c.id,
        title: c.name,
        payload: {
          name: c.name,
          kind: c.kind,
          creature_type: c.creatureType,
          description: c.description,
          ...(c.shareStats ? { challenge: c.challenge, armor_class: c.armorClass, hit_points: c.hitPoints } : {}),
        },
        reveal,
      })
      return true
    } catch (err) {
      setActionError(`Couldn’t share ${c.name}: ${err.message}`)
      return false
    } finally {
      setSharingId(null)
    }
  }

  async function remove(c) {
    const status = statusOf(c)
    const ok =
      status === 'added'
        ? window.confirm(`Delete your notes on “${c.name}”? The players’ copy stays. This can't be undone.`)
        : confirmDelete(`“${c.name}”`)
    if (!ok) return
    setActionError(null)
    try {
      await removeItem(c.id)
      await removeSharesFor(c.id)
    } catch (err) {
      setActionError(`Couldn’t delete: ${err.message}`)
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const editingStatus = editingId ? statusOf(items.find((c) => c.id === editingId) || {}) : 'private'

  return (
    <section className="creatures-tab dm-creatures">
      <DmPrivacyNote />

      <div className="creatures-tab__toolbar">
        <TabNav
          tabs={FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
          activeTab={filter}
          onSelect={setFilter}
          className="tab-nav--pill creatures-tab__filter"
          label="Show monsters or creatures"
        />
        <button type="button" className="btn btn--primary" onClick={() => openForm()}>
          + Add {filter === 'Creature' ? 'Creature' : 'Monster'}
        </button>
      </div>

      {actionError && (
        <p className="empty-state empty-state--error" role="alert">
          {actionError}
        </p>
      )}
      {loading && <p className="empty-state">Loading…</p>}
      {error && (
        <p className="empty-state empty-state--error">
          {error}
          {/dm_creatures/.test(error) && ' — run the latest supabase/schema.sql to add the DM monsters table.'}
        </p>
      )}
      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          {items.length === 0
            ? 'No monsters yet. Stat them out ahead of time — they stay private until you press Share.'
            : `No ${filter === 'Monster' ? 'monsters' : 'creatures'} yet.`}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="creature-list">
          {visible.map((c) => {
            const status = statusOf(c)
            const revealed = revealedKeys.has(shareKey('creature', c.id))
            return (
              <article
                className={`creature-card panel creature-card--${c.kind.toLowerCase()}${revealed ? ' dm-revealed' : ''}`}
                key={c.id}
              >
                <header className="creature-card__header">
                  <h3 className="creature-card__name">{c.name}</h3>
                  <span className={`creature-card__kind creature-card__kind--${c.kind.toLowerCase()}`}>
                    <span aria-hidden="true">{statIcon(c.kind)}</span> {c.kind}
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
                {c.description && <RichText className="creature-card__notes" value={c.description} />}
                {c.secrets && (
                  <div className="secret-npc__secrets">
                    <span className="secret-npc__secrets-label">DM only</span>
                    <RichText value={c.secrets} />
                  </div>
                )}
                <p className="creature-card__where">
                  <Icon name={c.shareStats ? 'chart' : 'lock'} /> {c.shareStats ? 'Stats are shared with players' : 'Stats stay hidden when shared'}
                </p>
                <div className="creature-card__actions">
                  <ShareStatus
                    kind="creature"
                    status={status}
                    sharing={sharingId === c.id}
                    onShare={() => share(c)}
                    onReveal={() => share(c, true)}
                    revealed={revealed}
                  />
                  <button type="button" className="btn btn--text" onClick={() => openForm(c)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => remove(c)}>
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

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
                  {statIcon(kind)} {kind}
                </button>
              ))}
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="dm-creature-name">Name</label>
                <input
                  id="dm-creature-name"
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder={form.kind === 'Monster' ? 'Red-web Spider Queen' : 'Giant Owl'}
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoFocus
                />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div className="field">
                <label htmlFor="dm-creature-type">Type</label>
                <input
                  id="dm-creature-type"
                  type="text"
                  list="dm-creature-types"
                  value={form.creatureType}
                  onChange={set('creatureType')}
                  placeholder="Beast, Undead…"
                />
                <datalist id="dm-creature-types">
                  {CREATURE_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="dm-creature-cr">Challenge (CR)</label>
                <input id="dm-creature-cr" type="text" value={form.challenge} onChange={set('challenge')} placeholder="5" />
              </div>
              <div className="field">
                <label htmlFor="dm-creature-ac">AC</label>
                <input
                  id="dm-creature-ac"
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
                <label htmlFor="dm-creature-hp">HP</label>
                <input
                  id="dm-creature-hp"
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
            <label className="art-form__check dm-creatures__check">
              <input
                type="checkbox"
                checked={form.shareStats}
                onChange={(e) => setForm({ ...form, shareStats: e.target.checked })}
              />
              Players see CR, AC and HP when I share it
            </label>
            <div className="field">
              <label htmlFor="dm-creature-description">Description (players see this)</label>
              <RichTextEditor
                id="dm-creature-description"
                value={form.description}
                onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                ariaLabel="Description (players see this)"
                placeholder="What the party sees: size, smell, sounds…"
              />
            </div>
            <div className="field">
              <label htmlFor="dm-creature-secrets"><Icon name="lock" /> DM notes (never shared)</label>
              <RichTextEditor
                id="dm-creature-secrets"
                value={form.secrets}
                onChange={(html) => setForm((prev) => ({ ...prev, secrets: html }))}
                ariaLabel="secrets"
                placeholder="Tactics, weaknesses, legendary actions, loot…"
              />
            </div>
            {editingStatus !== 'private' && (
              <p className="field-hint">Already shared — edits here don’t change what players have already added.</p>
            )}
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
    </section>
  )
}

export default DmCreaturesTab
