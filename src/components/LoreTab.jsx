import { useEffect, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Modal from './Modal.jsx'
import TagBadge from './TagBadge.jsx'
import { TAG_GROUPS, matchKind } from '../lib/tags.js'
import './LoreTab.scss'
import { confirmDelete } from '../lib/confirm.js'
import { RichText, RichTextEditor } from './RichText.jsx'
import FactionStanding from './FactionStanding.jsx'
import { isFaction } from '../lib/standing.js'
import { isClue } from '../lib/mysteries.js'
import { getStored, setStored } from '../lib/sessionMode.js'
import MysteryBoard from './MysteryBoard.jsx'
import Icon from './Icon.jsx'

const emptyForm = { title: '', category: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  notes: r.notes,
  standing: r.standing ?? null,
  standingLog: r.standing_log,
  mysteryId: r.mystery_id ?? null,
  clueStatus: r.clue_status ?? 'lead',
  foundIn: r.found_in ?? '',
  createdAt: r.created_at,
})
const mysteryFromRow = (r) => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  solvedIn: r.solved_in,
  solvedAt: r.solved_at,
  loreId: r.lore_id,
  createdAt: r.created_at,
})
const theoryFromRow = (r) => ({
  id: r.id,
  mysteryId: r.mystery_id,
  text: r.text,
  supports: r.supports || [],
  against: r.against || [],
  authorName: r.author_name,
  foundIn: r.found_in,
  createdAt: r.created_at,
})
const voteFromRow = (r) => ({ id: r.id, theoryId: r.theory_id, playerId: r.player_id })

const VIEW_KEY = 'dnd-notes-lore-view'

// Lore & Clues: the Mysteries board (open questions, their clues and
// theories) and the Lore codex (what's settled), one at a time.
function LoreTab({ campaignId }) {
  const shared = { campaign_id: campaignId }
  const lore = useSupabaseTable('lore_entries', { fromRow, orderBy: 'title', filters: shared })
  const mysteries = useSupabaseTable('mysteries', { fromRow: mysteryFromRow, filters: shared })
  const theories = useSupabaseTable('theories', { fromRow: theoryFromRow, filters: shared })
  const votes = useSupabaseTable('theory_votes', { fromRow: voteFromRow, filters: shared })
  const [view, setViewState] = useState(() => (getStored(VIEW_KEY, 'mysteries') === 'lore' ? 'lore' : 'mysteries'))
  const [openId, setOpenId] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const setView = (next) => {
    setViewState(next)
    setStored(VIEW_KEY, next)
  }
  const clueCount = lore.items.filter(isClue).length

  return (
    <section className="lore-tab">
      <div className="lore-tab__bar">
        <div className="lore-tab__switch" role="tablist" aria-label="Lore and Clues views">
          {[
            ['mysteries', 'Mysteries', 'search'],
            ['lore', 'Lore', 'scroll'],
          ].map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'is-on' : ''}
              onClick={() => {
                setView(id)
                setOpenId(null)
              }}
            >
              <Icon name={icon} /> {label}
              {id === 'mysteries' && clueCount > 0 && <span>{clueCount} clues</span>}
            </button>
          ))}
        </div>
      </div>
      {view === 'mysteries' ? (
        <MysteryBoard
          campaignId={campaignId}
          lore={lore}
          mysteries={mysteries}
          theories={theories}
          votes={votes}
          openId={openId}
          setOpenId={setOpenId}
          onShowLore={(id) => {
            setHighlight(id)
            setOpenId(null)
            setView('lore')
          }}
        />
      ) : (
        <LoreCodex
          lore={lore}
          mysteries={mysteries.items}
          highlight={highlight}
          onOpenMystery={(id) => {
            setView('mysteries')
            setOpenId(id)
          }}
        />
      )}
    </section>
  )
}

function LoreCodex({ lore, mysteries, highlight, onOpenMystery }) {
  const { loading, error, addItem, updateItem, removeItem } = lore
  const entries = lore.items.filter((e) => !isClue(e))
  const [category, setCategory] = useState('')
  useEffect(() => {
    if (highlight) document.getElementById(`lore-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])
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

  const categoryOf = (e) => e.category.trim() || 'Uncategorised'
  const categories = [...new Set(entries.map(categoryOf))].sort((a, b) => a.localeCompare(b))
  const shown = category ? entries.filter((e) => categoryOf(e) === category) : entries
  const groups = categories
    .map((c) => ({ name: c, items: shown.filter((e) => categoryOf(e) === c) }))
    .filter((g) => g.items.length > 0)
  const fromMystery = new Map(mysteries.filter((m) => m.loreId).map((m) => [m.loreId, m]))

  return (
    <div className="lore-codex">
      <div className="lore-tab__toolbar">
        {categories.length > 1 && (
          <div className="chip-row lore-codex__filters" role="group" aria-label="Filter by category">
            <button type="button" className={`chip${category ? '' : ' chip--active'}`} aria-pressed={!category} onClick={() => setCategory('')}>
              All <span>{entries.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip${category === c ? ' chip--active' : ''}`}
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? '' : c)}
              >
                {c} <span>{entries.filter((e) => categoryOf(e) === c).length}</span>
              </button>
            ))}
          </div>
        )}
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
          No lore recorded yet. Track the history, factions and legends of your world. Solved mysteries land
          here too.
        </p>
      )}

      {!loading &&
        !error &&
        groups.map((group) => (
          <section key={group.name} className="lore-codex__group" aria-label={group.name}>
            <h3 className="lore-codex__heading">{group.name}</h3>
        <div className="lore-list">
          {group.items.map((entry) => (
            <article id={`lore-${entry.id}`} className={`lore-card panel${highlight === entry.id ? ' lore-card--highlight' : ''}`} key={entry.id}>
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
              {fromMystery.has(entry.id) && (
                <button type="button" className="lore-card__mystery" onClick={() => onOpenMystery(fromMystery.get(entry.id).id)}>
                  <Icon name="check" /> Solved mystery{fromMystery.get(entry.id).solvedIn ? ` · ${fromMystery.get(entry.id).solvedIn}` : ''}: see the clues
                </button>
              )}
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
          </section>
        ))}
    </div>
  )
}

export default LoreTab
