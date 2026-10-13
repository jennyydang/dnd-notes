import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import DmPrivacyNote from './DmPrivacyNote.jsx'
import './NpcsTab.scss'
import './SecretNpcsTab.scss'

// Shares the NPC portrait bucket, so revealing an NPC can hand its photo
// to the players' copy without uploading it again.
const BUCKET = 'npc-portraits'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hidden', label: 'Not met yet' },
  { id: 'revealed', label: 'Revealed' },
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

const npcFromRow = (r) => ({ id: r.id })

// The DM's private NPC workshop: draft NPCs as you invent them (with
// secrets players never see), then "Reveal" one to drop a player-safe copy
// into the shared NPCs tab when the party meets them.
function SecretNpcsTab({ campaignId, addRequest }) {
  const { openEntity } = useCampaignNav()
  const { items, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('dm_npcs', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  // Only used to add the revealed copy (and to notice if players' copy
  // was deleted, which the foreign key also handles).
  const { items: sharedNpcs, addItem: addSharedNpc } = useSupabaseTable('npcs', {
    fromRow: npcFromRow,
    filters: { campaign_id: campaignId },
  })
  const sharedIds = useMemo(() => new Set(sharedNpcs.map((n) => n.id)), [sharedNpcs])

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

  // Home's "Secret NPC" quick action lands here with the form open.
  useEffect(() => {
    if (addRequest) openForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRequest])

  const isRevealed = (npc) => Boolean(npc.revealedNpcId && sharedIds.has(npc.revealedNpcId))
  const counts = {
    all: items.length,
    hidden: items.filter((n) => !isRevealed(n)).length,
    revealed: items.filter(isRevealed).length,
  }
  const needle = query.trim().toLowerCase()
  const visible = items
    .filter((n) => filter === 'all' || (filter === 'revealed') === isRevealed(n))
    .filter(
      (n) =>
        !needle ||
        [n.name, n.race, n.occupation, n.location, n.description, n.secrets].some((v) =>
          v?.toLowerCase().includes(needle),
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

  function pickPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
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

  async function reveal(npc) {
    const ok = window.confirm(
      `Add ${npc.name} to the party's NPCs tab?\n\nPlayers will see their name, race, where they're found, description and portrait — not your secret notes.`,
    )
    if (!ok) return
    setActionError(null)
    try {
      const description = [npc.occupation, npc.description].filter((v) => v?.trim()).join('\n\n')
      const created = await addSharedNpc({
        name: npc.name,
        race: npc.race,
        met_at: npc.location,
        status: 'Alive',
        description,
        photo_path: npc.photoPath || null,
      })
      await updateItem(npc.id, { revealed_npc_id: created.id })
    } catch (err) {
      setActionError(`Couldn’t reveal ${npc.name}: ${err.message}`)
    }
  }

  async function remove(npc) {
    if (isRevealed(npc)) {
      const ok = window.confirm(
        `Delete your secret notes on “${npc.name}”? The players’ copy in the NPCs tab stays. This can't be undone.`,
      )
      if (!ok) return
    } else if (!confirmDelete(`the secret NPC “${npc.name}”`)) return
    setActionError(null)
    try {
      await removeItem(npc.id)
      // The players' copy shares the portrait, so only clean it up if
      // nothing else uses it.
      if (npc.photoPath && !isRevealed(npc)) removeImage(BUCKET, npc.photoPath)
    } catch (err) {
      setActionError(`Couldn’t delete: ${err.message}`)
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const editingRevealed = editingId && isRevealed(items.find((n) => n.id === editingId) || {})

  return (
    <section className="secret-npcs">
      <DmPrivacyNote />

      <div className="secret-npcs__toolbar">
        <TabNav
          tabs={FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
          activeTab={filter}
          onSelect={setFilter}
          className="tab-nav--pill secret-npcs__filter"
          label="Filter secret NPCs"
        />
        <button type="button" className="btn btn--primary" onClick={() => openForm()}>
          + Secret NPC
        </button>
      </div>

      {items.length > 4 && (
        <input
          type="search"
          className="secret-npcs__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, places, secrets…"
          aria-label="Search secret NPCs"
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
            ? 'No secret NPCs yet. Jot them down as you invent them — players can’t see this list. When the party meets one, press Reveal.'
            : needle
              ? `Nothing matches “${query.trim()}”.`
              : filter === 'revealed'
                ? 'No one revealed yet.'
                : 'Everyone here has been revealed.'}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="npc-list">
          {visible.map((npc) => {
            const revealed = isRevealed(npc)
            return (
              <article className={`npc-card secret-npc panel${revealed ? ' secret-npc--revealed' : ''}`} key={npc.id}>
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
                  <span className={`secret-npc__badge${revealed ? ' secret-npc__badge--revealed' : ''}`}>
                    {revealed ? '👁 Revealed' : '🔒 Hidden'}
                  </span>
                </div>
                {npc.location && <p className="secret-npc__meta">📍 {npc.location}</p>}
                {npc.description && <p className="npc-card__description">{npc.description}</p>}
                {npc.secrets && (
                  <div className="secret-npc__secrets">
                    <span className="secret-npc__secrets-label">DM only</span>
                    <p>{npc.secrets}</p>
                  </div>
                )}
                <div className="npc-card__actions">
                  {revealed ? (
                    <button type="button" className="btn btn--text" onClick={() => openEntity('npc', npc.revealedNpcId)}>
                      Players’ copy
                    </button>
                  ) : (
                    <button type="button" className="btn btn--primary secret-npc__reveal" onClick={() => reveal(npc)}>
                      Reveal
                    </button>
                  )}
                  <button type="button" className="btn btn--text" onClick={() => openForm(npc)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => remove(npc)}>
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? 'Edit secret NPC' : 'New secret NPC'}>
          <form className="npc-form" onSubmit={submitForm} noValidate>
            <h3 className="section-card__title">{editingId ? 'Edit secret NPC' : 'New secret NPC'}</h3>
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
                <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                {form.photoPreview && (
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => {
                      revokePreview()
                      setForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
                    }}
                  >
                    Remove photo
                  </button>
                )}
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
              <textarea
                id="dm-npc-description"
                value={form.description}
                onChange={set('description')}
                placeholder="Looks, voice, mannerisms…"
              />
            </div>
            <div className="field">
              <label htmlFor="dm-npc-secrets">🔒 Secret notes (never shared)</label>
              <textarea
                id="dm-npc-secrets"
                value={form.secrets}
                onChange={set('secrets')}
                placeholder="Motives, what they know, plot hooks…"
              />
            </div>
            {editingRevealed && (
              <p className="field-hint">Already revealed — edits here don’t change the players’ copy.</p>
            )}
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="npc-form__actions">
              <button type="button" className="btn btn--text" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Secret NPC'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default SecretNpcsTab
