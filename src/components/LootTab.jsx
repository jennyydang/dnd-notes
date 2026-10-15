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
import { ViewToggle } from './ui.jsx'
import { useViewMode } from '../hooks/useViewMode.js'
import Icon from './Icon.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import { RichText, RichTextEditor } from './RichText.jsx'

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
  quantity: '',
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
  // null = not counted (a single item); a number = how many the party has.
  quantity: r.quantity ?? null,
  photo: getPublicUrl(BUCKET, r.photo_path),
  createdAt: r.created_at,
})

const partyFromRow = (r) => ({ id: r.id, name: r.name })

const hasQuantity = (entry) => entry.quantity !== null && entry.quantity !== undefined
// Used up: a counted item down to 0, or a single item marked used.
const isUsedUp = (entry) => entry.usable && (hasQuantity(entry) ? entry.quantity <= 0 : entry.used)
// Sparkle colour per tag: gold for magic items, purple for artifacts.
const glowClass = (kind) =>
  kind === 'Magic Item' ? ' loot-card--magic' : kind === 'Artifact' ? ' loot-card--artifact' : ''
const SPARKS = 8
const FX_MS = { new: 1600, dissolve: 1400 }

// The burst on a card that's just arrived, or the dust off one used up.
function LootSparkles({ dust = false }) {
  return (
    <span className={`loot-sparkles${dust ? ' loot-sparkles--dust' : ''}`} aria-hidden="true">
      {Array.from({ length: SPARKS }, (_, i) => (
        <span key={i} style={{ '--i': i }} />
      ))}
    </span>
  )
}

const QUANTITY_MISSING = 'Run the latest supabase/schema.sql first (it adds loot quantities).'

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
  const [view, setView] = useViewMode('loot')
  const [usingEntry, setUsingEntry] = useState(null)
  const [useError, setUseError] = useState(null)
  const [useCount, setUseCount] = useState(1)
  // One-off effects: 'new' when loot appears (here or from another
  // device), 'dissolve' when something gets used up.
  const [fx, setFx] = useState({})
  const seenRef = useRef(null)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => objectUrlRef.current && URL.revokeObjectURL(objectUrlRef.current), [])

  useEffect(() => {
    if (loading) return undefined
    const now = new Map(loot.map((e) => [e.id, isUsedUp(e)]))
    const seen = seenRef.current
    seenRef.current = now
    if (!seen) return undefined
    const changes = {}
    for (const [id, usedUp] of now) {
      if (!seen.has(id)) changes[id] = 'new'
      else if (usedUp && !seen.get(id)) changes[id] = 'dissolve'
    }
    const ids = Object.keys(changes)
    if (!ids.length) return undefined
    setFx((f) => ({ ...f, ...changes }))
    const timers = ids.map((id) =>
      setTimeout(
        () =>
          setFx((f) => {
            const next = { ...f }
            delete next[id]
            return next
          }),
        FX_MS[changes[id]],
      ),
    )
    return () => timers.forEach(clearTimeout)
  }, [loot, loading])

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
      quantity: hasQuantity(entry) ? String(entry.quantity) : '',
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

    const quantityText = String(form.quantity).trim()
    const quantity = quantityText === '' ? null : Number(quantityText)
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999)) {
      setFormError('Quantity is a whole number from 0 to 9999, or leave it blank.')
      return
    }
    const payload = {
      item: form.item,
      kind: form.kind,
      found_at: form.foundAt,
      holder: form.holder,
      notes: form.notes,
      usable: form.usable,
      // An item that's no longer usable can't stay "used" — otherwise it
      // would sit dimmed with no Use button to explain why. A counted
      // item is used up exactly when its quantity reaches 0.
      used: form.usable && (quantity === null ? form.used : quantity === 0),
    }
    // Only sent when there's a count to save (or one to clear), so loot
    // still saves on a database without the quantity column.
    const editingEntry = editingId ? loot.find((x) => x.id === editingId) : null
    if (quantity !== null || (editingEntry && hasQuantity(editingEntry))) payload.quantity = quantity

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
      setFormError(/quantity/.test(err.message) ? QUANTITY_MISSING : err.message)
    } finally {
      setSaving(false)
    }
  }

  function startUse(entry) {
    setUseError(null)
    setUseCount(1)
    setUsingEntry(entry)
  }

  function cancelUse() {
    setUsingEntry(null)
    setUseError(null)
  }

  // A counted item asks how many and deducts them, fading once it hits 0;
  // a single item just gets marked used.
  async function confirmUse() {
    const counted = hasQuantity(usingEntry)
    const left = counted ? Math.max(0, usingEntry.quantity - useCount) : 0
    try {
      await updateItem(usingEntry.id, counted ? { quantity: left, used: left === 0 } : { used: true })
      cancelUse()
    } catch (err) {
      setUseError(/quantity/.test(err.message) ? QUANTITY_MISSING : err.message)
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
            <div className="field">
              <label htmlFor="loot-quantity">Quantity</label>
              <input
                id="loot-quantity"
                type="number"
                inputMode="numeric"
                min="0"
                max="9999"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="Leave blank for a single item"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="loot-notes">Notes</label>
            <RichTextEditor
              id="loot-notes"
              value={form.notes}
              onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
              ariaLabel="Notes"
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
            {form.usable && String(form.quantity).trim() === '' && (
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
        {loot.length > 0 && <ViewToggle value={view} onChange={setView} label="Loot card size" />}
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
          {hasQuantity(usingEntry) ? (
            <div className="loot-use-confirm">
              <p>
                How many <strong>{usingEntry.item}</strong> do you want to use?
              </p>
              <div className="loot-use-confirm__count">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setUseCount((n) => Math.max(1, n - 1))}
                  disabled={useCount <= 1}
                  aria-label="One fewer"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={usingEntry.quantity}
                  value={useCount}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value))
                    setUseCount(Number.isFinite(n) ? Math.min(usingEntry.quantity, Math.max(1, n)) : 1)
                  }}
                  aria-label="How many to use"
                  autoFocus
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setUseCount((n) => Math.min(usingEntry.quantity, n + 1))}
                  disabled={useCount >= usingEntry.quantity}
                  aria-label="One more"
                >
                  +
                </button>
              </div>
              <p className="loot-use-confirm__left">
                {usingEntry.quantity - useCount === 0
                  ? 'That uses the last of them.'
                  : `${usingEntry.quantity - useCount} of ${usingEntry.quantity} left afterwards.`}
              </p>
              {useError && <p className="empty-state empty-state--error">{useError}</p>}
              <div className="loot-form__actions">
                <button type="button" className="btn btn--text" onClick={cancelUse}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary" onClick={confirmUse}>
                  Use {useCount}
                </button>
              </div>
            </div>
          ) : (
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
          )}
        </Modal>
      )}

      {/* Sort on the left, who-has-it filter on the right. */}
      {!loading && !error && (loot.length > 1 || holderTabs.length > 1) && (
        <div className="loot-tab__filters">
          {loot.length > 1 && (
            <TabNav
              tabs={SORT_MODES}
              activeTab={sortMode}
              onSelect={setSortMode}
              className="tab-nav--pill"
              label="Sort loot"
            />
          )}
          {holderTabs.length > 1 && (
            <TabNav
              tabs={holderTabs}
              activeTab={effectiveHolderView}
              onSelect={setHolderView}
              className="tab-nav--pill loot-tab__holders"
              label="Filter loot by holder"
            />
          )}
        </div>
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

      {!loading && !error && visibleLoot.length > 0 && view === 'compact' && (
        <div className="loot-list loot-list--compact">
          {visibleLoot.map((entry) => (
            <article
              className={`loot-card loot-card--compact panel${isUsedUp(entry) ? ' loot-card--used' : ''}${glowClass(entry.kind)}${fx[entry.id] ? ` loot-card--${fx[entry.id]}` : ''}`}
              key={entry.id}
            >
              {fx[entry.id] && <LootSparkles dust={fx[entry.id] === 'dissolve'} />}
              {entry.photo ? (
                <button
                  type="button"
                  className="loot-card__photo loot-card__photo--small"
                  onClick={() => setViewingPhoto(entry)}
                  aria-label={`View picture of ${entry.item}`}
                >
                  <img src={entry.photo} alt="" loading="lazy" />
                </button>
              ) : (
                <span className="loot-card__thumb" aria-hidden="true">
                  <Icon name="gem" />
                </span>
              )}
              <div className="loot-card__summary">
                <button
                  type="button"
                  className="loot-card__item loot-card__item-btn"
                  onClick={() => openEntity('loot', entry.id)}
                  title="Open with links and related entries"
                >
                  {entry.item}
                </button>
                <span className="loot-card__meta">
                  <TagBadge group="loot" kind={entry.kind} />
                  {hasQuantity(entry) && (
                    <span className="loot-card__qty">
                      ×<AnimatedNumber value={entry.quantity} />
                    </span>
                  )}
                  {entry.holder && <span className="loot-card__meta-text">Held by {entry.holder}</span>}
                </span>
              </div>
              {entry.usable && !isUsedUp(entry) && (
                <button type="button" className="btn btn--primary loot-card__use-compact" onClick={() => startUse(entry)}>
                  Use
                </button>
              )}
              {isUsedUp(entry) && (
                <span className="loot-card__used-tag loot-card__used-tag--inline">{hasQuantity(entry) ? 'Used up' : 'Used'}</span>
              )}
              <div className="compact-actions">
                <button type="button" className="icon-btn" onClick={() => startEditing(entry)} aria-label={`Edit ${entry.item}`}>
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeLoot(entry.id)}
                  aria-label={`Delete ${entry.item}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && visibleLoot.length > 0 && view === 'cards' && (
        <div className="loot-list">
          {visibleLoot.map((entry) => (
            <article
              className={`loot-card panel${entry.usable ? ' loot-card--usable' : ''}${isUsedUp(entry) ? ' loot-card--used' : ''}${glowClass(entry.kind)}${fx[entry.id] ? ` loot-card--${fx[entry.id]}` : ''}`}
              key={entry.id}
            >
              {fx[entry.id] && <LootSparkles dust={fx[entry.id] === 'dissolve'} />}
              {entry.usable && !isUsedUp(entry) && (
                <button
                  type="button"
                  className="btn btn--primary loot-card__use"
                  onClick={() => startUse(entry)}
                >
                  Use
                </button>
              )}
              {isUsedUp(entry) && (
                <span className="loot-card__used-tag">{hasQuantity(entry) ? 'Used up' : 'Used'}</span>
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
                  {hasQuantity(entry) && (
                    <span className="loot-card__qty">
                      {entry.usable ? (
                        <>
                          <AnimatedNumber value={entry.quantity} /> left
                        </>
                      ) : (
                        <>
                          ×<AnimatedNumber value={entry.quantity} />
                        </>
                      )}
                    </span>
                  )}
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
              {entry.notes && <RichText className="loot-card__notes" value={entry.notes} />}
              <div className="loot-card__actions">
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
