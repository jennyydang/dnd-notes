import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDmShares } from '../hooks/useDmShares.js'
import { removeSharesFor, shareKey, shareWithPlayers } from '../lib/dmShares.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import ShareStatus from './ShareStatus.jsx'
import Icon from './Icon.jsx'
import './CreaturesTab.scss'
import './SecretNpcsTab.scss'
import { RichText, RichTextEditor } from './RichText.jsx'
import { CreatureHero, PhotoPicker } from './CreaturePhotos.jsx'
import TypeCombobox from './TypeCombobox.jsx'
import { CREATURE_TYPES, deletePhotos, photoList, savePickerItems, toPickerItems } from '../lib/creatures.js'

const emptyForm = { name: '', creatureType: '', description: '', secrets: '', photos: [] }

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  creatureType: r.creature_type,
  description: r.description,
  secrets: r.secrets,
  photos: photoList(r.photos),
  createdAt: r.created_at,
})

const partyFromRow = (r) => ({ id: r.id, dmCreatureId: r.dm_creature_id })

// The DM's private bestiary: write creatures up ahead of time (photos,
// what the party sees, private notes), then Share one when the party
// meets it. Players add a copy — photos included — to their Creatures tab.
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

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sharingId, setSharingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const visible = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  function openForm(creature = null) {
    setForm(
      creature
        ? {
            name: creature.name,
            creatureType: creature.creatureType,
            description: creature.description,
            secrets: creature.secrets,
            photos: toPickerItems(creature.photos),
          }
        : emptyForm,
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
    const errors = {}
    if (!form.name.trim()) errors.name = 'Give it a name.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setSaving(true)
    setFormError(null)
    try {
      const before = editingId ? items.find((c) => c.id === editingId)?.photos : []
      const { paths, removed } = await savePickerItems(form.photos, before)
      const payload = {
        name: form.name.trim(),
        kind: 'Creature',
        creature_type: form.creatureType.trim(),
        description: form.description,
        secrets: form.secrets,
        photos: paths,
      }
      if (editingId) await updateItem(editingId, payload)
      else await addItem(payload)
      await deletePhotos(removed)
      closeForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function share(c, reveal = false) {
    const what = 'name, type, photos and description'
    const message = reveal
      ? `Reveal ${c.name} to the table now?\n\nIt pops up on every player's screen and lands in their notifications. They'll see its ${what}. Never your DM notes.`
      : `Share ${c.name} with the players?\n\nEveryone gets a notification and can add it to Creatures. They'll see its ${what}. Never your DM notes.`
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
          kind: 'Creature',
          creature_type: c.creatureType,
          description: c.description,
          photos: c.photos,
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
    if (!ok) return false
    setActionError(null)
    try {
      await removeItem(c.id)
      await removeSharesFor(c.id)
      await deletePhotos(c.photos)
      return true
    } catch (err) {
      setActionError(`Couldn’t delete: ${err.message}`)
    }
  }

  // Delete from inside the edit dialog, then close it.
  async function deleteEditing() {
    const target = items.find((x) => x.id === editingId)
    if (target && (await remove(target))) closeForm()
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const editingStatus = editingId ? statusOf(items.find((c) => c.id === editingId) || {}) : 'private'

  return (
    <section className="creatures-tab dm-creatures">
      <DmPrivacyNote />

      <div className="creatures-tab__toolbar creatures-tab__toolbar--end">
        <button type="button" className="btn btn--primary" onClick={() => openForm()}>
          + Add Creature
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
          {/dm_creatures|photos/.test(error) && ' — run the latest supabase/schema.sql to update the DM creatures table.'}
        </p>
      )}
      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          No creatures yet. Write them up ahead of time — they stay private until you press Share.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="creature-list">
          {visible.map((c) => {
            const status = statusOf(c)
            const revealed = revealedKeys.has(shareKey('creature', c.id))
            return (
              <article
                className={`creature-card panel${revealed ? ' dm-revealed' : ''}`}
                key={c.id}
              >
                <CreatureHero photos={c.photos} name={c.name} type={c.creatureType} />
                <div className="creature-card__body">
                  {c.description && <RichText className="creature-card__notes" value={c.description} />}
                  {c.secrets && (
                    <div className="secret-npc__secrets">
                      <span className="secret-npc__secrets-label">DM only</span>
                      <RichText value={c.secrets} />
                    </div>
                  )}
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
                    <button type="button" className="btn btn--danger card-delete" onClick={() => remove(c)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? 'Edit Creature' : 'Add Creature'}>
          <form className="creature-form form-stack" onSubmit={submitForm} noValidate>
            <h3 className="section-card__title">{editingId ? 'Edit Creature' : 'Add Creature'}</h3>
            <div className="form-row">
              <div className="field">
                <label htmlFor="dm-creature-name">Name</label>
                <input
                  id="dm-creature-name"
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Red-web Spider Queen"
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoFocus
                />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div className="field">
                <label htmlFor="dm-creature-type">Type</label>
                <TypeCombobox
                  id="dm-creature-type"
                  value={form.creatureType}
                  onChange={(creatureType) => setForm((prev) => ({ ...prev, creatureType }))}
                  options={CREATURE_TYPES}
                  placeholder="Beast, Undead…"
                />
              </div>
            </div>
            <PhotoPicker id="dm-creature-photos" items={form.photos} onChange={(photos) => setForm((prev) => ({ ...prev, photos }))} />
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
              {/* Delete lives here, away from Save — not on the card. */}
              {editingId && (
                <button type="button" className="btn btn--danger form-delete" onClick={() => deleteEditing()}>
                  Delete
                </button>
              )}
              <button type="button" className="btn btn--text" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Creature'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default DmCreaturesTab
