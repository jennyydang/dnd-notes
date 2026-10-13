import { useEffect, useMemo, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import TabNav from './TabNav.jsx'
import Modal from './Modal.jsx'
import TagBadge from './TagBadge.jsx'
import { TAG_GROUPS, tagText } from '../lib/tags.js'
import './LootTab.scss'
import { confirmDelete } from '../lib/confirm.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import { getPublicUrl, uploadImage } from '../lib/storage.js'

const BUCKET = 'loot-photos'

const ALL_HOLDERS = 'all'
const UNCLAIMED = '__unclaimed__'

const SORT_MODES = [
  { id: 'recent', label: 'Last Added' },
  { id: 'alpha', label: 'A → Z' },
]

const emptyForm = {
  item: '',
  kind: '',
  foundAt: '',
  holder: '',
  notes: '',
  usable: false,
  used: false,
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  item: r.item,
  kind: r.kind,
  foundAt: r.found_at,
  holder: r.holder,
  notes: r.notes,
  usable: r.usable,
  used: r.used,
  photo: getPublicUrl(BUCKET, r.photo_path),
  createdAt: r.created_at,
})

const partyFromRow = (r) => ({ id: r.id, name: r.name })

function LootTab({ campaignId }) {
  const { openEntity } = useCampaignNav()
  const { items: loot, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('loot', { fromRow, filters: { campaign_id: campaignId } })
  // Pulled in just so a party member shows up as a holder tab the moment
  // they join, rather than only after loot gets logged under their name.
  const { items: party } = useSupabaseTable('party_members', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [holderView, setHolderView] = useState(ALL_HOLDERS)
  const [sortMode, setSortMode] = useState('recent')
  const [usingEntry, setUsingEntry] = useState(null)
  const [useError, setUseError] = useState(null)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => objectUrlRef.current && URL.revokeObjectURL(objectUrlRef.current), [])

  function revokePreview() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }

  // Every picked photo goes through the crop/zoom/move step first.
  const photoCrop = useImageCrop({ aspect: 1, shape: 'rect', onCropped: applyPhoto })

  function applyPhoto(file) {
    revokePreview()
    objectUrlRef.current = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, photoFile: file, photoPreview: objectUrlRef.current, photoRemoved: false }))
  }

  function removePhoto() {
    revokePreview()
    setForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
  }

  // Sorted client-side rather than via the hook's server-side orderBy so
  // the toggle can flip instantly without a refetch. "Last Added" reads
  // newest-first off created_at; useSupabaseTable's default fetch order
  // doesn't matter here since both branches re-sort the full list anyway.
  const sortedLoot = useMemo(() => {
    const list = [...loot]
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.item.trim().localeCompare(b.item.trim()))
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return list
  }, [loot, sortMode])

  const holders = [...new Set([
    ...loot.map((entry) => entry.holder.trim()),
    ...party.map((member) => member.name.trim()),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const hasUnclaimed = loot.some((entry) => !entry.holder.trim())

  const holderTabs = [
    { id: ALL_HOLDERS, label: 'All' },
    ...holders.map((holder) => ({ id: holder, label: holder })),
    ...(hasUnclaimed ? [{ id: UNCLAIMED, label: 'Unclaimed' }] : []),
  ]

  // A holder tab can disappear (its last item got deleted, edited to a new
  // holder, or the holder text changed) out from under whatever's
  // selected — derive the effective view each render instead of syncing
  // state, so it falls back to "All" rather than silently filtering to
  // nothing with no tab shown as active.
  const effectiveHolderView = holderTabs.some((tab) => tab.id === holderView)
    ? holderView
    : ALL_HOLDERS

  const visibleLoot = sortedLoot.filter((entry) => {
    if (effectiveHolderView === ALL_HOLDERS) return true
    if (effectiveHolderView === UNCLAIMED) return !entry.holder.trim()
    return entry.holder.trim() === effectiveHolderView
  })

  function startAdding() {
    revokePreview()
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(entry) {
    setForm({
      item: entry.item,
      kind: entry.kind,
      foundAt: entry.foundAt,
      holder: entry.holder,
      notes: entry.notes,
      usable: entry.usable,
      used: entry.used,
      photoFile: null,
      photoPreview: entry.photo || '',
      photoRemoved: false,
    })
    revokePreview()
    setIsAdding(false)
    setFormError(null)
    setEditingId(entry.id)
  }

  function cancelForm() {
    revokePreview()
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.item.trim() || saving) return

    const payload = {
      item: form.item,
      kind: form.kind,
      found_at: form.foundAt,
      holder: form.holder,
      notes: form.notes,
      usable: form.usable,
      // An item that's no longer usable can't stay "used" — otherwise it
      // would sit dimmed with no Use button to explain why.
      used: form.usable && form.used,
    }

    setSaving(true)
    try {
      if (form.photoFile) payload.photo_path = await uploadImage(BUCKET, form.photoFile)
      else if (form.photoRemoved) payload.photo_path = null
      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function cancelUse() {
    setUsingEntry(null)
    setUseError(null)
  }

  async function confirmUse() {
    try {
      await updateItem(usingEntry.id, { used: true })
      cancelUse()
    } catch (err) {
      setUseError(err.message)
    }
  }

  async function removeLoot(id) {
    const target = loot.find((x) => x.id === id)
    if (!confirmDelete(target?.item ? `“${target.item}”` : 'this item')) return
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  function renderLootForm(standalone) {
    return (
    <form className={`loot-form panel${standalone ? ' loot-form--standalone' : ''}`} onSubmit={submitForm}>
          <div className="loot-form__photo">
            <button
              type="button"
              className="loot-form__photo-btn"
              onClick={() => photoInputRef.current?.click()}
              aria-label={form.photoPreview ? 'Change the picture' : 'Add a picture'}
            >
              {form.photoPreview ? <img src={form.photoPreview} alt="" /> : <span>+ Picture</span>}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={photoCrop.fromInput} />
            {form.photoPreview && (
              <div className="loot-form__photo-actions">
                <button type="button" className="btn btn--text" onClick={() => photoCrop.adjust(form.photoFile, form.photoPreview)}>
                  Adjust
                </button>
                <button type="button" className="btn btn--text" onClick={removePhoto}>
                  Remove
                </button>
              </div>
            )}
            {photoCrop.dialog}
          </div>
          <div className="loot-form__grid">
            <div className="field">
              <label htmlFor="loot-item">Item</label>
              <input
                id="loot-item"
                type="text"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder="Ring of Feather Falling"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="loot-kind">Tag</label>
              <select
                id="loot-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="">None</option>
                {TAG_GROUPS.loot.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {tagText('loot', kind)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="loot-found">Where we got it</label>
              <input
                id="loot-found"
                type="text"
                value={form.foundAt}
                onChange={(e) => setForm({ ...form, foundAt: e.target.value })}
                placeholder="Chest in the Sunken Crypt"
              />
            </div>
            <div className="field">
              <label htmlFor="loot-holder">Who has it</label>
              <input
                id="loot-holder"
                type="text"
                value={form.holder}
                onChange={(e) => setForm({ ...form, holder: e.target.value })}
                placeholder="Party stash / Thessaly"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="loot-notes">Notes</label>
            <textarea
              id="loot-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Unidentified, seems to hum faintly near water..."
            />
          </div>
          <div className="loot-form__checks">
            <label className="loot-form__check">
              <input
                type="checkbox"
                checked={form.usable}
                onChange={(e) => setForm({ ...form, usable: e.target.checked })}
              />
              Can be used
            </label>
            {form.usable && (
              <label className="loot-form__check">
                <input
                  type="checkbox"
                  checked={form.used}
                  onChange={(e) => setForm({ ...form, used: e.target.checked })}
                />
                Already used
              </label>
            )}
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="loot-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Loot'}
            </button>
          </div>
        </form>
    )
  }

  return (
    <section className="loot-tab">
      <div className="loot-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Loot
        </button>
      </div>

      {isAdding && renderLootForm(true)}

      {editingId && (
        <Modal onClose={cancelForm} label="Edit Loot">
          {renderLootForm(false)}
        </Modal>
      )}

      {viewingPhoto && (
        <Modal onClose={() => setViewingPhoto(null)} label={viewingPhoto.item}>
          <figure className="loot-photo-view">
            <img src={viewingPhoto.photo} alt={viewingPhoto.item} />
            <figcaption>{viewingPhoto.item}</figcaption>
          </figure>
        </Modal>
      )}

      {usingEntry && (
        <Modal onClose={cancelUse} label="Use Loot">
          <div className="loot-use-confirm">
            <p>
              Are you sure you want to use <strong>{usingEntry.item}</strong>?
            </p>
            {useError && <p className="empty-state empty-state--error">{useError}</p>}
            <div className="loot-form__actions">
              <button type="button" className="btn btn--text" onClick={cancelUse}>
                No
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmUse} autoFocus>
                Yes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {!loading && !error && loot.length > 1 && (
        <TabNav
          tabs={SORT_MODES}
          activeTab={sortMode}
          onSelect={setSortMode}
          className="tab-nav--pill"
          label="Sort loot"
        />
      )}

      {!loading && !error && holderTabs.length > 1 && (
        <TabNav
          tabs={holderTabs}
          activeTab={effectiveHolderView}
          onSelect={setHolderView}
          className="tab-nav--pill"
          label="Filter loot by holder"
        />
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && loot.length === 0 && (
        <p className="empty-state">
          No loot logged yet. Track the treasures your party has claimed.
        </p>
      )}

      {!loading && !error && loot.length > 0 && visibleLoot.length === 0 && (
        <p className="empty-state">Nobody here — try a different holder.</p>
      )}

      {!loading && !error && visibleLoot.length > 0 && (
        <div className="loot-list">
          {visibleLoot.map((entry) => (
            <article
              className={`loot-card panel${entry.usable ? ' loot-card--usable' : ''}${entry.usable && entry.used ? ' loot-card--used' : ''}`}
              key={entry.id}
            >
              {entry.usable && !entry.used && (
                <button
                  type="button"
                  className="btn btn--primary loot-card__use"
                  onClick={() => setUsingEntry(entry)}
                >
                  Use
                </button>
              )}
              {entry.usable && entry.used && (
                <span className="loot-card__used-tag">Used</span>
              )}
              <div className="loot-card__head">
                {entry.photo && (
                  <button
                    type="button"
                    className="loot-card__photo"
                    onClick={() => setViewingPhoto(entry)}
                    aria-label={`View picture of ${entry.item}`}
                  >
                    <img src={entry.photo} alt="" loading="lazy" />
                  </button>
                )}
                <div className="loot-card__main">
                  <h3 className="loot-card__item">{entry.item}</h3>
                  <TagBadge group="loot" kind={entry.kind} />
                  {entry.foundAt && (
                    <span className="loot-card__found-at">{entry.foundAt}</span>
                  )}
                </div>
              </div>
              {entry.holder && (
                <p className="loot-card__holder">
                  <span>Held by</span> {entry.holder}
                </p>
              )}
              {entry.notes && <p className="loot-card__notes">{entry.notes}</p>}
              <div className="loot-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => openEntity('loot', entry.id)}
                  aria-label={`Links and related entries for ${entry.item}`}
                >
                  Links
                </button>
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeLoot(entry.id)}
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

export default LootTab
