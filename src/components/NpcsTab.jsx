import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import Modal from './Modal.jsx'
import './NpcsTab.scss'
import { confirmDelete } from '../lib/confirm.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import { ViewToggle } from './ui.jsx'
import { useViewMode } from '../hooks/useViewMode.js'
import Icon from './Icon.jsx'
import { RichText, RichTextEditor } from './RichText.jsx'

const BUCKET = 'npc-portraits'
const LIFE_STATUSES = ['Alive', 'Deceased', 'Unknown', 'Missing']

const emptyForm = {
  name: '',
  race: '',
  metAt: '',
  status: 'Alive',
  description: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  race: r.race,
  metAt: r.met_at,
  status: r.status,
  description: r.description,
  photo: getPublicUrl(BUCKET, r.photo_path),
})

function NpcsTab({ campaignId }) {
  const { openEntity } = useCampaignNav()
  const { items: npcs, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('npcs', { fromRow, orderBy: 'met_at', filters: { campaign_id: campaignId } })
  const [view, setView] = useViewMode('npcs')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const photoInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function revokeTrackedObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  function startAdding() {
    revokeTrackedObjectUrl()
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(npc) {
    revokeTrackedObjectUrl()
    setForm({
      name: npc.name,
      race: npc.race,
      metAt: npc.metAt,
      status: npc.status,
      description: npc.description,
      photoFile: null,
      photoPreview: npc.photo || '',
      photoRemoved: false,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(npc.id)
  }

  function cancelForm() {
    revokeTrackedObjectUrl()
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setSubmitting(false)
  }

  // Every picked photo goes through the crop/zoom/move step first.
  const photoCrop = useImageCrop({ aspect: 1, shape: 'circle', onCropped: applyPhoto, onRemove: removePhoto })

  function applyPhoto(file) {

    revokeTrackedObjectUrl()
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setForm((prev) => ({
      ...prev,
      photoFile: file,
      photoPreview: previewUrl,
      photoRemoved: false,
    }))
  }

  function removePhoto() {
    revokeTrackedObjectUrl()
    setForm((prev) => ({ ...prev, photoFile: null, photoPreview: '', photoRemoved: true }))
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload = {
      name: form.name,
      race: form.race,
      met_at: form.metAt,
      status: form.status,
      description: form.description,
    }

    setSubmitting(true)
    try {
      if (form.photoFile) {
        payload.photo_path = await uploadImage(BUCKET, form.photoFile)
      } else if (form.photoRemoved) {
        payload.photo_path = null
      }

      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
      setSubmitting(false)
    }
  }

  async function removeNpc(id) {
    const target = npcs.find((x) => x.id === id)
    if (!confirmDelete(target?.name ? `“${target.name}”` : 'this NPC')) return
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  function renderNpcForm(standalone) {
    return (
    <form className={`npc-form panel${standalone ? ' npc-form--standalone' : ''}`} onSubmit={submitForm}>
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
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={photoCrop.fromInput}
              />
              {form.photoPreview && (
                <button type="button" className="btn btn--text" onClick={() => photoCrop.adjust(form.photoFile, form.photoPreview)}>
                  Edit photo
                </button>
              )}
              {photoCrop.dialog}
            </div>

            <div className="npc-form__grid">
              <div className="field">
                <label htmlFor="npc-name">Name</label>
                <input
                  id="npc-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Elandra Voss"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="npc-race">Race</label>
                <input
                  id="npc-race"
                  type="text"
                  value={form.race}
                  onChange={(e) => setForm({ ...form, race: e.target.value })}
                  placeholder="Half-elf"
                />
              </div>
              <div className="field">
                <label htmlFor="npc-met">Where we met them</label>
                <input
                  id="npc-met"
                  type="text"
                  value={form.metAt}
                  onChange={(e) => setForm({ ...form, metAt: e.target.value })}
                  placeholder="The Rusty Tankard, Waterdeep"
                />
              </div>
              <div className="field">
                <label htmlFor="npc-status">Life status</label>
                <select
                  id="npc-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {LIFE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="npc-description">Description</label>
            <RichTextEditor
              id="npc-description"
              value={form.description}
              onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
              ariaLabel="Description"
              placeholder="What they look like, how they talk, anything worth remembering..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="npc-form__actions">
            {/* Delete lives here, away from Save — not on the card. */}
            {editingId && (
              <button type="button" className="btn btn--danger form-delete" onClick={() => removeNpc(editingId)}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn--text" onClick={cancelForm} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add NPC'}
            </button>
          </div>
        </form>
    )
  }

  return (
    <section className="npcs-tab">
      <div className="npcs-tab__toolbar">
        {npcs.length > 0 && <ViewToggle value={view} onChange={setView} label="NPC card size" />}
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add NPC
        </button>
      </div>

      {isAdding && (

        <Modal onClose={cancelForm} label="Add NPC">

          {renderNpcForm(false)}

        </Modal>

      )}

      {editingId && (
        <Modal onClose={cancelForm} label="Edit NPC">
          {renderNpcForm(false)}
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && npcs.length === 0 && (
        <p className="empty-state">
          No NPCs recorded yet. Add the folks your party has met along the way.
        </p>
      )}

      {!loading && !error && npcs.length > 0 && view === 'compact' && (
        <div className="npc-list npc-list--compact">
          {npcs.map((npc) => (
            <article
              className={`npc-card npc-card--compact panel${npc.status === 'Deceased' ? ' npc-card--deceased' : ''}`}
              key={npc.id}
            >
              <div className="npc-card__avatar npc-card__avatar--small">
                {npc.photo ? (
                  <img src={npc.photo} alt="" />
                ) : (
                  <span aria-hidden="true">{npc.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="npc-card__summary">
                <button
                  type="button"
                  className="npc-card__name npc-card__name-btn"
                  onClick={() => openEntity('npc', npc.id)}
                  title="Open with links and related entries"
                >
                  {npc.name}
                </button>
                <span className="npc-card__meta">
                  <span className={`status-badge status-badge--${npc.status.toLowerCase()}`}>{npc.status}</span>
                  {(npc.race || npc.metAt) && (
                    <span className="npc-card__meta-text">{[npc.race, npc.metAt].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
              </div>
              <div className="compact-actions">
                <button type="button" className="icon-btn" onClick={() => startEditing(npc)} aria-label={`Edit ${npc.name}`}>
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger card-delete"
                  onClick={() => removeNpc(npc.id)}
                  aria-label={`Delete ${npc.name}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && npcs.length > 0 && view === 'cards' && (
        <div className="npc-list">
          {npcs.map((npc) => (
            <article className={`npc-card panel${npc.status === 'Deceased' ? ' npc-card--deceased' : ''}`} key={npc.id}>
              <div className="npc-card__main">
                <div className="npc-card__identity">
                  <div className="npc-card__avatar">
                    {npc.photo ? (
                      <img src={npc.photo} alt={npc.name} />
                    ) : (
                      <span>{npc.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {/* Status sits under the name, so the name gets the
                      card's full width instead of sharing it with the pill. */}
                  <div className="npc-card__who">
                    <h3 className="npc-card__name">{npc.name}</h3>
                    <span className={`status-badge status-badge--${npc.status.toLowerCase()}`}>
                      {npc.status}
                    </span>
                  </div>
                </div>
              </div>
              <dl className="npc-card__details">
                <div>
                  <dt>Race</dt>
                  <dd>{npc.race || '—'}</dd>
                </div>
                <div>
                  <dt>Where we met them</dt>
                  <dd>{npc.metAt || '—'}</dd>
                </div>
              </dl>
              {npc.description && <RichText className="npc-card__description" value={npc.description} />}
              <div className="npc-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(npc)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger card-delete"
                  onClick={() => removeNpc(npc.id)}
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

export default NpcsTab
