import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDmShares } from '../hooks/useDmShares.js'
import { removeSharesFor, shareKey, shareWithPlayers } from '../lib/dmShares.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import ShareStatus from './ShareStatus.jsx'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import Icon from './Icon.jsx'
import './NpcsTab.scss'
import './SecretNpcsTab.scss'
import { RichText, RichTextEditor } from './RichText.jsx'
import { joinNotes, notesToPlainText } from '../lib/richNotes.js'

// Same bucket as the players' NPC portraits; adding a shared NPC copies
// the photo, so each side owns its own file.
const BUCKET = 'npc-portraits'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'private', label: 'Private' },
  { id: 'shared', label: 'Shared' },
]

const emptyForm = {
  name: '',
  race: '',
  occupation: '',
  location: '',
  description: '',
  secrets: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  race: r.race,
  occupation: r.occupation,
  location: r.location,
  description: r.description,
  secrets: r.secrets,
  photoPath: r.photo_path,
  photo: getPublicUrl(BUCKET, r.photo_path),
  revealedNpcId: r.revealed_npc_id,
  createdAt: r.created_at,
})

const npcFromRow = (r) => ({ id: r.id, dmNpcId: r.dm_npc_id })

// The DM's private NPC workshop: draft NPCs as you invent them (with
// secrets players never see), then "Share" one when the party meets them.
// Players get a notification and can add a player-safe copy to their NPCs
// tab (see DmSharesInbox).
function SecretNpcsTab({ campaignId, addRequest }) {
  const { byKey, revealedKeys } = useDmShares(campaignId)
  const { items, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('dm_npcs', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  // The players' NPCs, to tell which of these they've added.
  const { items: partyNpcs } = useSupabaseTable('npcs', {
    fromRow: npcFromRow,
    filters: { campaign_id: campaignId },
  })
  const addedIds = useMemo(() => {
    const ids = new Set(partyNpcs.map((n) => n.dmNpcId).filter(Boolean))
    return ids
  }, [partyNpcs])
  const partyIds = useMemo(() => new Set(partyNpcs.map((n) => n.id)), [partyNpcs])
  const [sharingId, setSharingId] = useState(null)

  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => objectUrlRef.current && URL.revokeObjectURL(objectUrlRef.current), [])

  // Home's quick action lands here with the form open.
  useEffect(() => {
    if (addRequest) openForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRequest])

  // 'added' (in the players' NPCs — including ones revealed before
  // sharing existed), 'sent' (notification out) or 'private'.
  const statusOf = (npc) =>
    addedIds.has(npc.id) || (npc.revealedNpcId && partyIds.has(npc.revealedNpcId))
      ? 'added'
      : byKey.has(shareKey('npc', npc.id))
        ? 'sent'
        : 'private'
  const isShared = (npc) => statusOf(npc) !== 'private'
  const counts = {
    all: items.length,
    private: items.filter((n) => !isShared(n)).length,
    shared: items.filter(isShared).length,
  }
  const needle = query.trim().toLowerCase()
  const visible = items
    .filter((n) => filter === 'all' || (filter === 'shared') === isShared(n))
    .filter(
      (n) =>
        !needle ||
        [n.name, n.race, n.occupation, n.location, notesToPlainText(n.description), notesToPlainText(n.secrets)].some(
          (v) => v?.toLowerCase().includes(needle),
        ),
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  function revokePreview() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }

  function openForm(npc = null) {
    revokePreview()
    setForm(
      npc
        ? {
            name: npc.name,
            race: npc.race,
            occupation: npc.occupation,
            location: npc.location,
            description: npc.description,
            secrets: npc.secrets,
            photoFile: null,
            photoPreview: npc.photo || '',
            photoRemoved: false,
          }
        : emptyForm,
    )
    setEditingId(npc?.id || null)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    revokePreview()
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  // Every picked photo goes through the crop/zoom/move step first.
  const photoCrop = useImageCrop({ aspect: 1, shape: 'circle', onCropped: applyPhoto, onRemove: removePhoto })

  function removePhoto() {
    revokePreview()
    setForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
  }

  function applyPhoto(file) {
    revokePreview()
    objectUrlRef.current = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, photoFile: file, photoPreview: objectUrlRef.current, photoRemoved: false }))
  }

  async function submitForm(event) {
    event.preventDefault()
    if (saving) return
    if (!form.name.trim()) {
      setFormError('Give them a name.')
      return
    }
    const payload = {
      name: form.name.trim(),
      race: form.race.trim(),
      occupation: form.occupation.trim(),
      location: form.location.trim(),
      description: form.description,
      secrets: form.secrets,
    }
    setSaving(true)
    try {
      if (form.photoFile) payload.photo_path = await uploadImage(BUCKET, form.photoFile)
      else if (form.photoRemoved) payload.photo_path = null
      if (editingId) await updateItem(editingId, payload)
      else await addItem(payload)
      closeForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function share(npc, reveal = false) {
    const ok = window.confirm(
      reveal
        ? `Reveal ${npc.name} to the table now?\n\nIt pops up on every player's screen and lands in their notifications. They'll see the name, race, where they're found, description and portrait — never your secret notes.`
        : `Share ${npc.name} with the players?\n\nEveryone gets a notification and can add them to the NPCs tab. They'll see the name, race, where they're found, description and portrait — never your secret notes.`,
    )
    if (!ok) return false
    setActionError(null)
    setSharingId(npc.id)
    try {
      await shareWithPlayers({
        campaignId,
        kind: 'npc',
        sourceId: npc.id,
        title: npc.name,
        payload: {
          name: npc.name,
          race: npc.race,
          location: npc.location,
          description: joinNotes([npc.occupation, npc.description]),
          photo_path: npc.photoPath || null,
        },
        reveal,
      })
      return true
    } catch (err) {
      setActionError(`Couldn’t share ${npc.name}: ${err.message}`)
      return false
    } finally {
      setSharingId(null)
    }
  }

  async function remove(npc) {
    const status = statusOf(npc)
    if (status === 'added') {
      const ok = window.confirm(
        `Delete your secret notes on “${npc.name}”? The players’ copy in their NPCs tab stays. This can't be undone.`,
      )
      if (!ok) return false
    } else if (!confirmDelete(`the NPC “${npc.name}”`)) return false
    setActionError(null)
    try {
      await removeItem(npc.id)
      if (status === 'sent') await removeSharesFor(npc.id)
      // The players' copy (and an unadded notification) may still point at
      // the portrait, so only clean it up for an NPC that was never shared.
      if (npc.photoPath && status === 'private') removeImage(BUCKET, npc.photoPath)
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
  const editingStatus = editingId ? statusOf(items.find((n) => n.id === editingId) || {}) : 'private'

  return (
    <section className="secret-npcs">
      <DmPrivacyNote />

      <div className="secret-npcs__toolbar">
        <TabNav
          tabs={FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
          activeTab={filter}
          onSelect={setFilter}
          className="tab-nav--pill secret-npcs__filter"
          label="Filter NPCs"
        />
        <button type="button" className="btn btn--primary" onClick={() => openForm()}>
          + Add NPC
        </button>
      </div>

      {items.length > 4 && (
        <input
          type="search"
          className="secret-npcs__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, places, secrets…"
          aria-label="Search your NPCs"
        />
      )}

      {actionError && (
        <p className="empty-state empty-state--error" role="alert">
          {actionError}
        </p>
      )}
      {loading && <p className="empty-state">Loading…</p>}
      {error && (
        <p className="empty-state empty-state--error">
          {error}
          {/dm_npcs/.test(error) && ' — run the latest supabase/schema.sql to add the DM tables.'}
        </p>
      )}
      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          {items.length === 0
            ? 'No NPCs yet. Jot them down as you invent them — players can’t see this list. When the party meets one, press Share.'
            : needle
              ? `Nothing matches “${query.trim()}”.`
              : filter === 'shared'
                ? 'Nothing shared yet.'
                : 'Everyone here has been shared.'}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="npc-list">
          {visible.map((npc) => {
            const status = statusOf(npc)
            const revealed = revealedKeys.has(shareKey('npc', npc.id))
            return (
              <article
                className={`npc-card secret-npc panel${status !== 'private' ? ' secret-npc--revealed' : ''}${revealed ? ' dm-revealed' : ''}`}
                key={npc.id}
              >
                <div className="npc-card__main">
                  <div className="npc-card__identity">
                    <div className="npc-card__avatar">
                      {npc.photo ? <img src={npc.photo} alt={npc.name} /> : <span>{npc.name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div>
                      <h3 className="npc-card__name">{npc.name}</h3>
                      {(npc.race || npc.occupation) && (
                        <p className="secret-npc__meta">{[npc.race, npc.occupation].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                  <span className={`secret-npc__badge${status !== 'private' ? ' secret-npc__badge--revealed' : ''}`}>
                    <Icon name={status === 'private' ? 'lock' : 'eye'} /> {status === 'private' ? 'Private' : 'Shared'}
                  </span>
                </div>
                {npc.location && <p className="secret-npc__meta"><Icon name="pin" /> {npc.location}</p>}
                {npc.description && <RichText className="npc-card__description" value={npc.description} />}
                {npc.secrets && (
                  <div className="secret-npc__secrets">
                    <span className="secret-npc__secrets-label">DM only</span>
                    <RichText value={npc.secrets} />
                  </div>
                )}
                <div className="npc-card__actions">
                  <ShareStatus
                    kind="npc"
                    status={status}
                    sharing={sharingId === npc.id}
                    onShare={() => share(npc)}
                    onReveal={() => share(npc, true)}
                    revealed={revealed}
                    className="secret-npc__share"
                  />
                  <button type="button" className="btn btn--text" onClick={() => openForm(npc)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger card-delete" onClick={() => remove(npc)}>
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? 'Edit NPC' : 'New NPC'}>
          <form className="npc-form" onSubmit={submitForm} noValidate>
            <h3 className="section-card__title">{editingId ? 'Edit NPC' : 'New NPC'}</h3>
            <div className="npc-form__layout">
              <div className="npc-form__photo">
                <button
                  type="button"
                  className="npc-form__photo-btn"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Choose a portrait photo"
                >
                  {form.photoPreview ? (
                    <img src={form.photoPreview} alt="NPC portrait" />
                  ) : (
                    <span className="npc-form__photo-placeholder">+ Photo</span>
                  )}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={photoCrop.fromInput} />
                {form.photoPreview && (
                  <button type="button" className="btn btn--text" onClick={() => photoCrop.adjust(form.photoFile, form.photoPreview)}>
                    Edit photo
                  </button>
                )}
                {photoCrop.dialog}
              </div>
              <div className="npc-form__grid">
                <div className="field">
                  <label htmlFor="dm-npc-name">Name</label>
                  <input id="dm-npc-name" type="text" value={form.name} onChange={set('name')} placeholder="Mother Hesk" autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="dm-npc-race">Race</label>
                  <input id="dm-npc-race" type="text" value={form.race} onChange={set('race')} placeholder="Tiefling" />
                </div>
                <div className="field">
                  <label htmlFor="dm-npc-occupation">Role / occupation</label>
                  <input id="dm-npc-occupation" type="text" value={form.occupation} onChange={set('occupation')} placeholder="Herbalist, cult informant" />
                </div>
                <div className="field">
                  <label htmlFor="dm-npc-location">Where they’re found</label>
                  <input id="dm-npc-location" type="text" value={form.location} onChange={set('location')} placeholder="Smyrnia, the dye market" />
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="dm-npc-description">Description (players see this if revealed)</label>
              <RichTextEditor
                id="dm-npc-description"
                value={form.description}
                onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                ariaLabel="Description (players see this if revealed)"
                placeholder="Looks, voice, mannerisms…"
              />
            </div>
            <div className="field">
              <label htmlFor="dm-npc-secrets"><Icon name="lock" /> Secret notes (never shared)</label>
              <RichTextEditor
                id="dm-npc-secrets"
                value={form.secrets}
                onChange={(html) => setForm((prev) => ({ ...prev, secrets: html }))}
                ariaLabel="secrets"
                placeholder="Motives, what they know, plot hooks…"
              />
            </div>
            {editingStatus !== 'private' && (
              <p className="field-hint">Already shared — edits here don’t change what players have already added.</p>
            )}
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="npc-form__actions">
              {/* Delete lives here, away from Save — not on the card. */}
              {editingId && (
                <button type="button" className="btn btn--danger form-delete" onClick={() => deleteEditing()}>
                  Delete
                </button>
              )}
              <button type="button" className="btn btn--text" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save NPC'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default SecretNpcsTab
