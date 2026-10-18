import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Modal from './Modal.jsx'
import TagBadge from './TagBadge.jsx'
import { TAG_GROUPS, matchKind } from '../lib/tags.js'
import './LoreTab.scss'
import { confirmDelete } from '../lib/confirm.js'
import { RichText, RichTextEditor } from './RichText.jsx'
import FactionStanding from './FactionStanding.jsx'
import { isFaction } from '../lib/standing.js'

const emptyForm = { title: '', category: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  notes: r.notes,
  standing: r.standing ?? null,
  standingLog: r.standing_log,
})

function LoreTab({ campaignId }) {
  const { items: entries, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('lore_entries', {
      fromRow,
      orderBy: 'title',
      filters: { campaign_id: campaignId },
    })
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

  function startAdding() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setIsAdding(true)
  }

  function startEditing(entry) {
    setForm({
      title: entry.title,
      category: entry.category,
      notes: entry.notes,
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(entry.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload = {
      title: form.title,
      category: form.category,
      notes: form.notes,
    }

    try {
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

  async function removeEntry(id) {
    const target = entries.find((x) => x.id === id)
    if (!confirmDelete(target?.title ? `“${target.title}”` : 'this lore entry')) return
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  function renderLoreForm(standalone) {
    return (
    <form className={`lore-form panel${standalone ? ' lore-form--standalone' : ''}`} onSubmit={submitForm}>
          <div className="lore-form__grid">
            <div className="field">
              <label htmlFor="lore-title">Title</label>
              <input
                id="lore-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="The Sundering of Elarion"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="lore-category">Category</label>
              <input
                id="lore-category"
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Faction / Lore / Religion / History"
                list="lore-category-tags"
              />
              <datalist id="lore-category-tags">
                {TAG_GROUPS.lore.kinds.map((kind) => (
                  <option key={kind} value={kind} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label htmlFor="lore-notes">Notes</label>
            <RichTextEditor
              id="lore-notes"
              value={form.notes}
              onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
              ariaLabel="Notes"
              placeholder="Centuries ago, the kingdom of Elarion split in two after..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="lore-form__actions">
            {/* Delete lives here, away from Save — not on the card. */}
            {editingId && (
              <button type="button" className="btn btn--danger form-delete" onClick={() => removeEntry(editingId)}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Lore'}
            </button>
          </div>
        </form>
    )
  }

  return (
    <section className="lore-tab">
      <div className="lore-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Lore
        </button>
      </div>

      {isAdding && (

        <Modal onClose={cancelForm} label="Add Lore">

          {renderLoreForm(false)}

        </Modal>

      )}

      {editingId && (
        <Modal onClose={cancelForm} label="Edit Lore">
          {renderLoreForm(false)}
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="empty-state">
          No lore recorded yet. Track the history, locations, and legends of
          your world.
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="lore-list">
          {entries.map((entry) => (
            <article className="lore-card panel" key={entry.id}>
              <div className="lore-card__main">
                <h3 className="lore-card__title">{entry.title}</h3>
                {/* A category matching a ~tag shows as that tag's badge;
                    any other free-text category keeps the plain label. */}
                {matchKind('lore', entry.category) ? (
                  <TagBadge group="lore" kind={entry.category} />
                ) : (
                  entry.category && <span className="lore-card__category">{entry.category}</span>
                )}
              </div>
              {isFaction(entry) && (
                <div className="lore-card__standing">
                  <FactionStanding faction={entry} onSave={(patch) => updateItem(entry.id, patch)} />
                </div>
              )}
              {entry.notes && <RichText className="lore-card__notes" value={entry.notes} />}
              <div className="lore-card__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => startEditing(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger card-delete"
                  onClick={() => removeEntry(entry.id)}
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

export default LoreTab
