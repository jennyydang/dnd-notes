import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import './Dashboard.scss'

const BUCKET = 'campaign-covers'

const emptyForm = {
  name: '',
  description: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  archived: r.archived,
  joinCode: r.join_code,
  cover: getPublicUrl(BUCKET, r.cover_image_path),
})

function Dashboard({ onOpenCampaign }) {
  const { items: campaigns, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('campaigns', { fromRow })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
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

  function startEditing(campaign) {
    revokeTrackedObjectUrl()
    setForm({
      name: campaign.name,
      description: campaign.description,
      photoFile: null,
      photoPreview: campaign.cover || '',
      photoRemoved: false,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(campaign.id)
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
      description: form.description,
    }

    try {
      if (form.photoFile) {
        payload.cover_image_path = await uploadImage(BUCKET, form.photoFile)
      } else if (form.photoRemoved) {
        payload.cover_image_path = null
      }

      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem({ ...payload, archived: false })
      }
      cancelForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function toggleArchived(campaign) {
    await updateItem(campaign.id, { archived: !campaign.archived })
  }

  async function deleteCampaign(campaign) {
    const confirmed = window.confirm(
      `Delete "${campaign.name}" permanently? This removes everything in it — maps, NPCs, loot, quests, party, lore, and session notes. This can't be undone.`,
    )
    if (!confirmed) return
    await removeItem(campaign.id)
    if (editingId === campaign.id) cancelForm()
  }

  const showForm = isAdding || editingId !== null
  const visibleCampaigns = campaigns.filter((c) => (showArchived ? c.archived : !c.archived))
  const archivedCount = campaigns.filter((c) => c.archived).length

  return (
    <section className="dashboard">
      <div className="dashboard__toolbar">
        <button
          type="button"
          className="btn btn--text"
          onClick={() => setShowArchived((prev) => !prev)}
        >
          {showArchived ? 'Show active campaigns' : `Show archived (${archivedCount})`}
        </button>
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + New Campaign
        </button>
      </div>

      {showForm && (
        <form className="campaign-form panel" onSubmit={submitForm}>
          <div className="campaign-form__layout">
            <div className="campaign-form__photo">
              <button
                type="button"
                className="campaign-form__photo-btn"
                onClick={() => photoInputRef.current?.click()}
              >
                {form.photoPreview ? (
                  <img src={form.photoPreview} alt="Campaign cover" />
                ) : (
                  <span className="campaign-form__photo-placeholder">+ Cover</span>
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
                  Remove cover
                </button>
              )}
            </div>

            <div className="campaign-form__fields">
              <div className="field">
                <label htmlFor="campaign-name">Name</label>
                <input
                  id="campaign-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Curse of Strahd"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="campaign-description">Description</label>
                <textarea
                  id="campaign-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Homebrew arc set in the shadow of Barovia..."
                />
              </div>
            </div>
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="campaign-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && visibleCampaigns.length === 0 && (
        <p className="empty-state">
          {showArchived
            ? 'No archived campaigns.'
            : 'No campaigns yet. Create one to start your Adventurer’s Log.'}
        </p>
      )}

      {!loading && !error && visibleCampaigns.length > 0 && (
        <div className="campaign-list">
          {visibleCampaigns.map((campaign) => (
            <article className="campaign-card panel" key={campaign.id}>
              <button
                type="button"
                className="campaign-card__open"
                onClick={() => onOpenCampaign(campaign)}
              >
                <div className="campaign-card__cover">
                  {campaign.cover ? (
                    <img src={campaign.cover} alt={campaign.name} />
                  ) : (
                    <span>{campaign.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="campaign-card__text">
                  <h3 className="campaign-card__name">
                    {campaign.name}
                    {campaign.joinCode && (
                      <span className="campaign-card__join-code">{campaign.joinCode}</span>
                    )}
                  </h3>
                  {campaign.description && (
                    <p className="campaign-card__description">{campaign.description}</p>
                  )}
                </div>
              </button>
              <div className="campaign-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(campaign)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => toggleArchived(campaign)}
                >
                  {campaign.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => deleteCampaign(campaign)}
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

export default Dashboard
