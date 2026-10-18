import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Modal from './Modal.jsx'
import './QuestsTab.scss'
import { confirmDelete } from '../lib/confirm.js'
import { RichText, RichTextEditor } from './RichText.jsx'
import Icon from './Icon.jsx'
import { useCampaignData } from '../hooks/useCampaignData.js'
import { DeadlineBadge, DueInField } from './Deadline.jsx'
import { dueDayFromForm, dueInFromDay } from '../lib/calendar.js'

const QUEST_STATUSES = ['Rumour', 'Active', 'Completed', 'Failed']

// The quest board's columns. Dropping a card on Done completes it (it can
// be marked Failed from its Edit dialog).
const COLUMNS = [
  { id: 'rumour', label: 'Rumours', hint: 'Heard about, not taken on', statuses: ['Rumour'], drop: 'Rumour' },
  { id: 'active', label: 'Active', hint: 'What the party is working on', statuses: ['Active'], drop: 'Active' },
  { id: 'done', label: 'Done', hint: 'Completed or failed', statuses: ['Completed', 'Failed'], drop: 'Completed' },
]
const LONG_PRESS_MS = 350
const DRAG_START_PX = 6

// Drag a card to another column: straight away with a mouse, after a
// short press on touch (so the page still scrolls). The card follows the
// pointer; the column under it lights up; dropping moves the quest.
function useBoardDrag(onDrop) {
  const [drag, setDrag] = useState(null) // { id, x, y, w, h, dx, dy, over }
  const start = useRef(null)
  const timer = useRef(null)

  const pointer = useRef(null)
  const dragging = Boolean(drag)

  const columnAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-quest-column]')?.dataset.questColumn || null

  function begin(s, x, y) {
    s.active = true
    navigator.vibrate?.(10)
    setDrag({ id: s.id, x, y, w: s.rect.width, h: s.rect.height, dx: s.dx, dy: s.dy, over: columnAt(x, y) })
  }

  useEffect(() => {
    function move(e) {
      const s = start.current
      if (!s) return
      if (!s.active) {
        const far = Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_START_PX
        if (s.touch) {
          if (far) cancel() // a scroll, not a drag
          return
        }
        if (!far) return
        begin(s, e.clientX, e.clientY)
      }
      e.preventDefault()
      pointer.current = { x: e.clientX, y: e.clientY }
      setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: columnAt(e.clientX, e.clientY) })
    }
    function up(e) {
      const s = start.current
      clearTimeout(timer.current)
      start.current = null
      if (!s?.active) return
      const over = columnAt(e.clientX, e.clientY)
      setDrag(null)
      if (over) onDrop(s.id, over)
    }
    function cancel() {
      clearTimeout(timer.current)
      start.current = null
      setDrag(null)
    }
    // Once a long press has picked a card up, the finger drags it instead
    // of scrolling the page (otherwise the browser takes over and cancels).
    function holdScroll(e) {
      if (start.current?.active) e.preventDefault()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchmove', holdScroll, { passive: false })
    return () => {
      window.removeEventListener('touchmove', holdScroll)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  })

  // Near the top or bottom of the screen the page scrolls, so a card can
  // reach a column that's off screen (on a phone the columns stack).
  useEffect(() => {
    if (!dragging) return
    let frame
    const EDGE = 70
    function tick() {
      const p = pointer.current
      if (p) {
        const step = p.y < EDGE ? -(EDGE - p.y) / 4 : p.y > window.innerHeight - EDGE ? (p.y - window.innerHeight + EDGE) / 4 : 0
        if (step) {
          window.scrollBy(0, step)
          setDrag((d) => d && { ...d, over: columnAt(p.x, p.y) })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      pointer.current = null
    }
  }, [dragging])

  function cardProps(id) {
    return {
      onPointerDown(e) {
        if (e.button > 0 || e.target.closest('button, a, input, select, textarea')) return
        const rect = e.currentTarget.getBoundingClientRect()
        const s = {
          id,
          x: e.clientX,
          y: e.clientY,
          rect,
          dx: e.clientX - rect.left,
          dy: e.clientY - rect.top,
          touch: e.pointerType !== 'mouse',
          active: false,
        }
        start.current = s
        if (s.touch) timer.current = setTimeout(() => start.current === s && begin(s, s.x, s.y), LONG_PRESS_MS)
      },
      // A long press shouldn't open the phone's text-selection menu.
      onContextMenu: (e) => (drag || start.current?.touch) && e.preventDefault(),
    }
  }

  return { drag, cardProps }
}

const emptyForm = { name: '', status: 'Active', givenBy: '', notes: '', dueIn: '' }

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  givenBy: r.given_by,
  notes: r.notes,
  dueDay: r.due_day ?? null,
})

function QuestsTab({ campaignId }) {
  const { calendar } = useCampaignData()
  const { items: quests, loading, error, addItem, updateItem, removeItem } =
    useSupabaseTable('quests', { fromRow, filters: { campaign_id: campaignId } })
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

  function startEditing(quest) {
    setForm({
      name: quest.name,
      status: quest.status,
      givenBy: quest.givenBy,
      notes: quest.notes,
      dueIn: dueInFromDay(quest.dueDay, calendar.day),
    })
    setIsAdding(false)
    setFormError(null)
    setEditingId(quest.id)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function submitForm(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    const payload = {
      name: form.name,
      status: form.status,
      given_by: form.givenBy,
      notes: form.notes,
    }
    // Only sent when there is (or was) a deadline, so quests still save on
    // a database that hasn't had the calendar SQL yet.
    const before = editingId ? quests.find((q) => q.id === editingId)?.dueDay : null
    const dueDay = dueDayFromForm(form.dueIn, dueInFromDay(before, calendar.day), before, calendar.day)
    if (dueDay !== null || before != null) payload.due_day = dueDay

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

  async function removeQuest(id) {
    const target = quests.find((x) => x.id === id)
    if (!confirmDelete(target?.name ? `“${target.name}”` : 'this quest')) return
    await removeItem(id)
    if (editingId === id) cancelForm()
  }

  // Move a quest to a board column (drag, or the ‹ › buttons).
  async function moveQuest(id, columnId) {
    const quest = quests.find((q) => q.id === id)
    const column = COLUMNS.find((c) => c.id === columnId)
    if (!quest || !column || column.statuses.includes(quest.status)) return
    try {
      await updateItem(id, { status: column.drop })
    } catch (err) {
      setBoardError(err.message)
    }
  }
  const board = useBoardDrag(moveQuest)
  const [boardError, setBoardError] = useState(null)

  // A quest that has just been completed (or failed) — here or by another
  // player — gets its stamp brought down with a thump.
  const lastStatus = useRef(null)
  const [stamped, setStamped] = useState(() => new Set())
  useEffect(() => {
    const before = lastStatus.current
    lastStatus.current = new Map(quests.map((q) => [q.id, q.status]))
    if (!before) return undefined
    const fresh = quests.filter((q) => ['Completed', 'Failed'].includes(q.status) && before.has(q.id) && before.get(q.id) !== q.status)
    if (!fresh.length) return undefined
    setStamped((s) => new Set([...s, ...fresh.map((q) => q.id)]))
    const id = setTimeout(() => setStamped(new Set()), 1400)
    return () => clearTimeout(id)
  }, [quests])

  function renderQuestForm(standalone) {
    return (
    <form className={`quest-form panel${standalone ? ' quest-form--standalone' : ''}`} onSubmit={submitForm}>
          <div className="quest-form__grid">
            <div className="field">
              <label htmlFor="quest-name">Quest</label>
              <input
                id="quest-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Clear the Sunken Crypt"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quest-given-by">Given by</label>
              <input
                id="quest-given-by"
                type="text"
                value={form.givenBy}
                onChange={(e) => setForm({ ...form, givenBy: e.target.value })}
                placeholder="Mayor Alderin"
              />
            </div>
            <div className="field">
              <label htmlFor="quest-status">Status</label>
              <select
                id="quest-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {QUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DueInField id="quest-due" value={form.dueIn} onChange={(dueIn) => setForm((prev) => ({ ...prev, dueIn }))} />
          <div className="field">
            <label htmlFor="quest-notes">Notes</label>
            <RichTextEditor
              id="quest-notes"
              value={form.notes}
              onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
              ariaLabel="Notes"
              placeholder="Rumored to be guarded by an undead knight..."
            />
          </div>
          {formError && <p className="empty-state empty-state--error">{formError}</p>}
          <div className="quest-form__actions">
            {/* Delete lives here, away from Save — not on the card. */}
            {editingId && (
              <button type="button" className="btn btn--danger form-delete" onClick={() => removeQuest(editingId)}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn--text" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {editingId ? 'Save Changes' : 'Add Quest'}
            </button>
          </div>
        </form>
    )
  }

  return (
    <section className="quests-tab">
      <div className="quests-tab__toolbar">
        <button type="button" className="btn btn--primary" onClick={startAdding}>
          + Add Quest
        </button>
      </div>

      {isAdding && (

        <Modal onClose={cancelForm} label="Add Quest">

          {renderQuestForm(false)}

        </Modal>

      )}

      {editingId && (
        <Modal onClose={cancelForm} label="Edit Quest">
          {renderQuestForm(false)}
        </Modal>
      )}

      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && quests.length === 0 && (
        <p className="empty-state">
          No quests logged yet. Track what your party is working towards.
        </p>
      )}

      {!loading && !error && quests.length > 0 && (
        <div className={`quest-board${board.drag ? ' is-dragging' : ''}`}>
          {COLUMNS.map((column, ci) => {
            const cards = quests.filter((q) => column.statuses.includes(q.status))
            return (
              <section
                key={column.id}
                className={`quest-board__column quest-board__column--${column.id}${board.drag?.over === column.id ? ' is-over' : ''}`}
                data-quest-column={column.id}
                aria-label={`${column.label} quests`}
              >
                <header className="quest-board__head">
                  <h3>
                    {column.label} <span className="quest-board__count">{cards.length}</span>
                  </h3>
                  <p>{column.hint}</p>
                </header>
                <div className="quest-board__cards">
                  {cards.length === 0 && <p className="quest-board__empty">Drop a quest here</p>}
                  {cards.map((quest) => {
                    const done = quest.status === 'Completed' || quest.status === 'Failed'
                    const dragging = board.drag?.id === quest.id
                    return (
                      <article
                        key={quest.id}
                        className={`quest-card panel${done ? ` quest-card--${quest.status.toLowerCase()}` : ''}${dragging ? ' is-lifted' : ''}`}
                        {...board.cardProps(quest.id)}
                      >
                        {done && (
                          <span
                            className={`quest-card__stamp${stamped.has(quest.id) ? ' is-new' : ''}`}
                            aria-hidden="true"
                          >
                            {quest.status}
                          </span>
                        )}
                        <div className="quest-card__main">
                          <h3 className="quest-card__name">{quest.name}</h3>
                          <span className={`status-badge status-badge--${quest.status.toLowerCase()}`}>{quest.status}</span>
                        </div>
                        {quest.givenBy && <p className="quest-card__given-by">Given by {quest.givenBy}</p>}
                        {!done && <DeadlineBadge dueDay={quest.dueDay} />}
                        {quest.notes && <RichText className="quest-card__notes" value={quest.notes} />}
                        <div className="quest-card__actions">
                          {/* Move a column left / right (touch and keyboard). */}
                          <button
                            type="button"
                            className="btn btn--text quest-card__move"
                            disabled={ci === 0}
                            onClick={() => moveQuest(quest.id, COLUMNS[ci - 1]?.id)}
                            aria-label={ci > 0 ? `Move ${quest.name} to ${COLUMNS[ci - 1].label}` : undefined}
                            title={ci > 0 ? `Move to ${COLUMNS[ci - 1].label}` : undefined}
                          >
                            <Icon name="prev" />
                          </button>
                          <button
                            type="button"
                            className="btn btn--text quest-card__move"
                            disabled={ci === COLUMNS.length - 1}
                            onClick={() => moveQuest(quest.id, COLUMNS[ci + 1]?.id)}
                            aria-label={ci < COLUMNS.length - 1 ? `Move ${quest.name} to ${COLUMNS[ci + 1].label}` : undefined}
                            title={ci < COLUMNS.length - 1 ? `Move to ${COLUMNS[ci + 1].label}` : undefined}
                          >
                            <Icon name="next" />
                          </button>
                          <button type="button" className="btn btn--text quest-card__edit" onClick={() => startEditing(quest)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn--danger card-delete" onClick={() => removeQuest(quest.id)}>
                            Delete
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {boardError && <p className="empty-state empty-state--error">{boardError}</p>}

      {/* The card being dragged, following the pointer. */}
      {board.drag &&
        createPortal(
          (() => {
            const quest = quests.find((q) => q.id === board.drag.id)
            if (!quest) return null
            return (
              <div
                className="quest-ghost panel"
                style={{ left: board.drag.x - board.drag.dx, top: board.drag.y - board.drag.dy, width: board.drag.w }}
                aria-hidden="true"
              >
                <div className="quest-card__main">
                  <h3 className="quest-card__name">{quest.name}</h3>
                  <span className={`status-badge status-badge--${quest.status.toLowerCase()}`}>{quest.status}</span>
                </div>
                {quest.givenBy && <p className="quest-card__given-by">Given by {quest.givenBy}</p>}
              </div>
            )
          })(),
          document.body,
        )}
    </section>
  )
}

export default QuestsTab
