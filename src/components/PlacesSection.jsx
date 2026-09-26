import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { TAG_GROUPS, tagText } from '../lib/tags.js'
import Modal from './Modal.jsx'
import TagBadge from './TagBadge.jsx'
import './PlacesSection.scss'
import { confirmDelete } from '../lib/confirm.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'

const PLACE_KINDS = TAG_GROUPS.place.kinds

const emptyForm = { name: '', kind: PLACE_KINDS[0], notes: '' }

const fromRow = (r) => ({ id: r.id, name: r.name, kind: r.kind, notes: r.notes })

// Named places (cities, dungeons, regions…) listed under the Maps tab.
// Mostly filled in from session notes, where tagging "#city Waterdeep"
// creates the card here — this is where the player adds details later.
function PlacesSection({ campaignId }) {
  const { openEntity } = useCampaignNav()
  const { items: places, loading, error, addItem, updateItem, removeItem } = useSupabaseTable(
    'places',
    { fromRow, orderBy: 'name', filters: { campaign_id: campaignId } },
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setFormOpen(true)
  }

  function startEditing(place) {
    setForm({ name: place.name, kind: place.kind, notes: place.notes })
    setEditingId(place.id)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    const payload = { name: form.name, kind: form.kind, notes: form.notes }
    try {
      if (editingId) {
        await updateItem(editingId, payload)
      } else {
        await addItem(payload)
      }
      closeForm()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function removePlace(id) {
    const target = places.find((x) => x.id === id)
    if (!confirmDelete(target?.name ? `“${target.name}”` : 'this place')) return
    await removeItem(id)
    if (editingId === id) closeForm()
  }

  return (
    <section className="places-section">
      <div className="places-section__header">
        <h3>Places</h3>
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Place
        </button>
      </div>

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? 'Edit Place' : 'Add Place'}>
          <form className="place-form" onSubmit={submitForm}>
            <div className="place-form__grid">
              <div className="field">
                <label htmlFor="place-name">Name</label>
                <input
                  id="place-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Waterdeep"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="place-kind">Tag</label>
                <select
                  id="place-kind"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                >
                  {PLACE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {tagText('place', kind)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="place-notes">Notes</label>
              <textarea
                id="place-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Walled port city, the harbour district smells of fish and trouble..."
              />
            </div>
            {formError && <p className="empty-state empty-state--error">{formError}</p>}
            <div className="place-form__actions">
              <button type="button" className="btn btn--text" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {editingId ? 'Save Changes' : 'Add Place'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && places.length === 0 && (
        <p className="empty-state">
          No places yet. Tag one in your session notes with <strong>#city</strong>,{' '}
          <strong>#dungeon</strong>, <strong>#region</strong> or <strong>#location</strong>, or
          add it here.
        </p>
      )}

      {!loading && !error && places.length > 0 && (
        <div className="places-section__grid">
          {places.map((place) => (
            <article className="place-card panel" key={place.id}>
              <div className="place-card__main">
                <h3 className="place-card__name">{place.name}</h3>
                <TagBadge group="place" kind={place.kind} />
              </div>
              {place.notes && <p className="place-card__notes">{place.notes}</p>}
              <div className="place-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => openEntity('place', place.id)}
                  aria-label={`Links and related entries for ${place.name}`}
                >
                  Links
                </button>
                <button type="button" className="btn btn--text" onClick={() => startEditing(place)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => removePlace(place.id)}
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

export default PlacesSection
