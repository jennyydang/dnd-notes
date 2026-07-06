import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import './NpcsTab.scss'

const BUCKET = 'npc-portraits'
const LIFE_STATUSES = ['Alive', 'Deceased', 'Unknown', 'Missing']

const emptyForm = {
  name: '',
  race: '',
  metAt: '',
  status: 'Alive',
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
  photo: getPublicUrl(BUCKET, r.photo_path),
})

function NpcsTab({ campaignId }) {
  const { items: npcs, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('npcs', { fromRow, filters: { campaign_id: campaignId } })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
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
  }

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

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
    }

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
    }
  }

  async function removeNpc(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="npcs-tab">
      <div className="npcs-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add NPC
        </button>
      </div>

      {showForm && (
        <form className="npc-form panel" onSubmit={submitForm}>
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
                onChange={handlePhotoSelected}
              />
              {form.photoPreview && (
                <button type="button" className="btn btn--text" onClick={removePhoto}>
                  Remove photo
                </button>
              )}
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
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="npc-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add NPC'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && npcs.length === 0 && (
        <p className="empty-state">
          No NPCs recorded yet. Add the folks your party has met along the way.
        </p>
      )}

      {!loading && !error && npcs.length > 0 && (
        <div className="npc-list">
          {npcs.map((npc) => (
            <article className="npc-card panel" key={npc.id}>
              <div className="npc-card__main">
                <div className="npc-card__identity">
                  <div className="npc-card__avatar">
                    {npc.photo ? (
                      <img src={npc.photo} alt={npc.name} />
                    ) : (
                      <span>{npc.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <h3 className="npc-card__name">{npc.name}</h3>
                </div>
                <span
                  className={`status-badge status-badge--${npc.status.toLowerCase()}`}
                >
                  {npc.status}
                </span>
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
                  className="btn btn--danger"
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
