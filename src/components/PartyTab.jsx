import { useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { getPublicUrl, uploadImage } from '../lib/storage.js'
import './PartyTab.scss'

const BUCKET = 'party-portraits'
const MEMBER_TYPES = ['Player', 'NPC']

const emptyForm = {
  name: '',
  memberType: 'Player',
  playerName: '',
  raceClass: '',
  notes: '',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  memberType: r.member_type,
  playerName: r.player_name,
  raceClass: r.race_class,
  notes: r.notes,
  photo: getPublicUrl(BUCKET, r.photo_path),
})

function PartyTab({ campaignId }) {
  const { items: party, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('party_members', { fromRow, filters: { campaign_id: campaignId } })
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

  function startEditing(member) {
    revokeTrackedObjectUrl()
    setForm({
      name: member.name,
      memberType: member.memberType,
      playerName: member.playerName,
      raceClass: member.raceClass,
      notes: member.notes,
      photoFile: null,
      photoPreview: member.photo || '',
      photoRemoved: false,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(member.id)
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
      member_type: form.memberType,
      player_name: form.memberType === 'Player' ? form.playerName : '',
      race_class: form.raceClass,
      notes: form.notes,
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

  async function removeMember(id) {
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="party-tab">
      <div className="party-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Party Member
        </button>
      </div>

      {showForm && (
        <form className="party-form panel" onSubmit={submitForm}>
          <div className="party-form__layout">
            <div className="party-form__photo">
              <button
                type="button"
                className="party-form__photo-btn"
                onClick={() => photoInputRef.current?.click()}
              >
                {form.photoPreview ? (
                  <img src={form.photoPreview} alt="Party member portrait" />
                ) : (
                  <span className="party-form__photo-placeholder">+ Photo</span>
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

            <div className="party-form__grid">
              <div className="field">
                <label htmlFor="party-name">Name</label>
                <input
                  id="party-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Kaelen Ashwood"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="party-type">Type</label>
                <select
                  id="party-type"
                  value={form.memberType}
                  onChange={(e) => setForm({ ...form, memberType: e.target.value })}
                >
                  {MEMBER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              {form.memberType === 'Player' && (
                <div className="field">
                  <label htmlFor="party-player-name">Player&rsquo;s real name</label>
                  <input
                    id="party-player-name"
                    type="text"
                    value={form.playerName}
                    onChange={(e) => setForm({ ...form, playerName: e.target.value })}
                    placeholder="Jenny"
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="party-race-class">Race / Class</label>
                <input
                  id="party-race-class"
                  type="text"
                  value={form.raceClass}
                  onChange={(e) => setForm({ ...form, raceClass: e.target.value })}
                  placeholder="Half-elf Ranger"
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="party-notes">Notes</label>
            <textarea
              id="party-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Joined the party after the battle at Redstone Bridge..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="party-form__actions">
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Party Member'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && party.length === 0 && (
        <p className="empty-state">
          No party members recorded yet. Add the players and NPC companions
          adventuring together.
        </p>
      )}

      {!loading && !error && party.length > 0 && (
        <div className="party-list">
          {party.map((member) => (
            <article className="party-card panel" key={member.id}>
              <div className="party-card__main">
                <div className="party-card__identity">
                  <div className="party-card__avatar">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} />
                    ) : (
                      <span>{member.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <h3 className="party-card__name">{member.name}</h3>
                </div>
                <span
                  className={`status-badge status-badge--${member.memberType.toLowerCase()}`}
                >
                  {member.memberType}
                </span>
              </div>
              <dl className="party-card__details">
                <div>
                  <dt>Race / Class</dt>
                  <dd>{member.raceClass || '—'}</dd>
                </div>
                {member.memberType === 'Player' && (
                  <div>
                    <dt>Played by</dt>
                    <dd>{member.playerName || '—'}</dd>
                  </div>
                )}
              </dl>
              {member.notes && <p className="party-card__notes">{member.notes}</p>}
              <div className="party-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(member)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removeMember(member.id)}
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

export default PartyTab
