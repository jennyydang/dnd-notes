import { useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { confirmDelete } from '../lib/confirm.js'
import Modal from './Modal.jsx'
import './CreaturesTab.scss'
import { RichText, RichTextEditor } from './RichText.jsx'
import { CreatureGallery, PhotoPicker } from './CreaturePhotos.jsx'
import { CREATURE_TYPES, deletePhotos, photoList, savePickerItems, toPickerItems } from '../lib/creatures.js'

const emptyForm = { name: '', creatureType: '', encounteredAt: '', notes: '', photos: [] }

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  creatureType: r.creature_type,
  encounteredAt: r.encountered_at,
  notes: r.notes,
  photos: photoList(r.photos),
  createdAt: r.created_at,
})

// Creatures the party has met, shared by the whole campaign: any player
// can add, edit or remove one, with as many photos as they like.
function CreaturesTab({ campaignId }) {
  const { items: creatures, loading, error, addItem, updateItem, removeItem } = useSupabaseTable('creatures', {
    fromRow,
    filters: { campaign_id: campaignId },
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [nameError, setNameError] = useState(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(
    () => [...creatures].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [creatures],
  )

  function openForm(creature = null) {
    setForm(
      creature
        ? {
            name: creature.name,
            creatureType: creature.creatureType,
            encounteredAt: creature.encounteredAt,
            notes: creature.notes,
            photos: toPickerItems(creature.photos),
          }
        : emptyForm,
    )
    setEditingId(creature?.id || null)
    setFormError(null)
    setNameError(null)
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
    if (!form.name.trim()) {
      setNameError('Give it a name.')
      return
    }
    setNameError(null)
    setSaving(true)
    setFormError(null)
    try {
      const before = editingId ? creatures.find((c) => c.id === editingId)?.photos : []
      const { paths, removed } = await savePickerItems(form.photos, before)
      const payload = {
        name: form.name.trim(),
        kind: 'Creature',
        creature_type: form.creatureType.trim(),
        encountered_at: form.encounteredAt.trim(),
        notes: form.notes,
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

  async function removeCreature(creature) {
    if (!confirmDelete(`“${creature.name}”`)) return false
    try {
      await removeItem(creature.id)
      await deletePhotos(creature.photos)
      return true
    } catch (err) {
      window.alert(`Couldn’t delete: ${err.message}`)
    }
  }

  // Delete from inside the edit dialog, then close it.
  async function deleteEditing() {
    const target = creatures.find((x) => x.id === editingId)
    if (target && (await removeCreature(target))) closeForm()
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <section className="creatures-tab">
      <div className="creatures-tab__toolbar creatures-tab__toolbar--end">
        <button type="button" className="btn btn--primary" onClick={() => openForm()}>
          + Add Creature
        </button>
      </div>

      {formOpen && (
        <Modal onClose={closeForm} label={editingId ? 'Edit Creature' : 'Add Creature'}>
          <form className="creature-form form-stack" onSubmit={submitForm} noValidate>
            <h3 className="section-card__title">{editingId ? 'Edit Creature' : 'Add Creature'}</h3>

            <div className="form-row">
              <div className="field">
                <label htmlFor="creature-name">Name</label>
                <input
                  id="creature-name"
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Young Black Dragon"
                  aria-invalid={Boolean(nameError)}
                  autoFocus
                />
                {nameError && <p className="field-error">{nameError}</p>}
              </div>
              <div className="field">
                <label htmlFor="creature-type">Type</label>
                <input
                  id="creature-type"
                  type="text"
                  list="creature-type-options"
                  value={form.creatureType}
                  onChange={set('creatureType')}
                  placeholder="Beast, Undead…"
                />
                <datalist id="creature-type-options">
                  {CREATURE_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="field">
              <label htmlFor="creature-where">Where we met it</label>
              <input id="creature-where" type="text" value={form.encounteredAt} onChange={set('encounteredAt')} placeholder="The Sunken Crypt" />
            </div>

            <PhotoPicker items={form.photos} onChange={(photos) => setForm((prev) => ({ ...prev, photos }))} />

            <div className="field">
              <label htmlFor="creature-notes">Notes</label>
              <RichTextEditor
                id="creature-notes"
                value={form.notes}
                onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
                ariaLabel="Notes"
                placeholder="Weak to radiant damage, flees when hurt…"
              />
            </div>

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

      {loading && <p className="empty-state">Loading…</p>}
      {error && (
        <p className="empty-state empty-state--error">
          {error}
          {/creatures|photos/.test(error) && ' — run the latest supabase/schema.sql to update the Creatures table.'}
        </p>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">No creatures yet. Add the things your party has fought, befriended or fled from.</p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="creature-list">
          {visible.map((c) => (
            <article className="creature-card panel" key={c.id}>
              <CreatureGallery photos={c.photos} name={c.name} />
              <header className="creature-card__header">
                <h3 className="creature-card__name">{c.name}</h3>
              </header>
              {c.creatureType && <p className="creature-card__meta">{c.creatureType}</p>}
              {c.encounteredAt && <p className="creature-card__where">Met: {c.encounteredAt}</p>}
              {c.notes && <RichText className="creature-card__notes" value={c.notes} />}
              <div className="creature-card__actions">
                <button type="button" className="btn btn--text" onClick={() => openForm(c)}>
                  Edit
                </button>
                <button type="button" className="btn btn--danger card-delete" onClick={() => removeCreature(c)}>
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

export default CreaturesTab
