import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useEdgeFades } from '../hooks/useEdgeFades.js'
import {
  goalFromRow,
  goalProgress,
  newStep,
  nextStep,
  readyToComplete,
  removeStep,
  renameStep,
  sortGoals,
  toggleStep,
} from '../lib/partyGoals.js'
import Modal from './Modal.jsx'
import { confirmDelete } from '../lib/confirm.js'
import { RichText, RichTextEditor } from './RichText.jsx'
import Icon from './Icon.jsx'
import './PartyGoals.scss'
import { DeadlineBadge, DueInField } from './Deadline.jsx'
import { dueDayFromForm, dueDayFromNow, dueInFromDay } from '../lib/calendar.js'

// The party's goals, shared by the Party tab and the Home / Session strip.
function usePartyGoals() {
  const { tables } = useCampaignData()
  const table = tables.goal
  const goals = table.items.map(goalFromRow)
  return { ...sortGoals(goals), table, loading: table.loading, error: table.error }
}

// A ring that fills with the goal's progress (the Home / Session strip).
export function ProgressRing({ value, size = 56, stroke = 5, label = true }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className={`progress-ring${value >= 1 ? ' is-full' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="progress-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="progress-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && <span className="progress-ring__text">{Math.round(value * 100)}%</span>}
    </span>
  )
}

// The round tick used for goals and their subtasks: an outline until it's
// done, then filled green.
function CheckCircle({ checked, label, onToggle, size = 'md' }) {
  return (
    <button
      type="button"
      className={`check-circle check-circle--${size}${checked ? ' is-checked' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        navigator.vibrate?.(10)
        onToggle()
      }}
    >
      <Icon name="check" />
    </button>
  )
}

function Subtasks({ goal, onSave }) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  return (
    <div className="goal-subtasks">
      <ul className="goal-subtasks__list">
        {goal.steps.map((step) => (
          <li key={step.id} className={`goal-subtasks__item${step.done ? ' is-done' : ''}`}>
            <CheckCircle
              size="sm"
              checked={step.done}
              label={step.text}
              onToggle={() => onSave(toggleStep(goal.steps, step.id))}
            />
            <input
              className="goal-subtasks__text"
              defaultValue={step.text}
              aria-label="Subtask"
              onBlur={(e) => {
                const text = e.target.value.trim()
                if (!text) e.target.value = step.text
                else if (text !== step.text) onSave(renameStep(goal.steps, step.id, text))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  e.currentTarget.value = step.text
                  e.currentTarget.blur()
                }
              }}
            />
            <button
              type="button"
              className="icon-btn goal-subtasks__remove"
              aria-label={`Remove subtask “${step.text}”`}
              onClick={() => onSave(removeStep(goal.steps, step.id))}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="goal-subtasks__add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            onSave([...goal.steps, newStep(draft)])
            setDraft('')
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => !draft.trim() && setAdding(false)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="Write a subtask, then Enter"
            aria-label={`Add a subtask to ${goal.title}`}
            maxLength={160}
          />
        </form>
      ) : (
        <button type="button" className="goal-subtasks__add-btn" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add subtask
        </button>
      )}
    </div>
  )
}

function GoalCard({ goal, onEdit, onSave, onToggleDone }) {
  const done = goal.status === 'Completed'
  const doneSteps = goal.steps.filter((s) => s.done).length
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  async function save(steps) {
    setError(null)
    try {
      await onSave({ steps })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className={`goal-card panel${done ? ' is-done' : ''}`}>
      <header className="goal-card__head">
        <CheckCircle checked={done} label={done ? `Reopen ${goal.title}` : `Complete ${goal.title}`} onToggle={onToggleDone} />
        <h4 className="goal-card__title">{goal.title}</h4>
        <button type="button" className="goal-card__edit" aria-label={`Edit ${goal.title}`} onClick={onEdit}>
          <Icon name="edit" />
        </button>
      </header>

      {!done && <DeadlineBadge dueDay={goal.dueDay} className="goal-card__due" />}
      {goal.notes && <RichText className="goal-card__notes" value={goal.notes} />}

      <footer className="goal-card__foot">
        <button
          type="button"
          className={`goal-card__toggle${open ? ' is-open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {goal.steps.length ? (
            <span className="goal-card__count">
              {doneSteps}/{goal.steps.length}
            </span>
          ) : (
            <span className="goal-card__count goal-card__count--none">Subtasks</span>
          )}
          <Icon name="subtasks" />
          <Icon name="next" className="goal-card__caret" />
        </button>
      </footer>

      {open && <Subtasks goal={goal} onSave={save} />}
      {error && <p className="field-error">{error}</p>}
    </article>
  )
}

// A board of goals as task cards: tick a goal off when it's done, and
// break it into subtasks. Used for the party's shared goals and for each
// player's private ones.
function GoalBoard({ table, kind, title, addLabel, emptyText, note }) {
  const { calendar } = useCampaignData()
  const { active, achieved } = sortGoals(table.items.map(goalFromRow))
  const { loading, error } = table
  const [editing, setEditing] = useState(null) // goal | 'new' | null
  const [form, setForm] = useState({ title: '', notes: '', steps: '', dueIn: '' })
  const [formError, setFormError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const goals = [...active, ...achieved]

  function open(goal) {
    setFormError(null)
    if (goal === 'new') setForm({ title: '', notes: '', steps: '', dueIn: '' })
    else setForm({ title: goal.title, notes: goal.notes, steps: '', dueIn: dueInFromDay(goal.dueDay, calendar.day) })
    setEditing(goal)
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    try {
      if (editing === 'new') {
        const steps = form.steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map(newStep)
        const due_day = dueDayFromNow(calendar.day, form.dueIn)
        await table.addItem({ title: form.title.trim(), notes: form.notes, steps, status: 'Active', ...(due_day !== null && { due_day }) })
      } else {
        const due_day = dueDayFromForm(form.dueIn, dueInFromDay(editing.dueDay, calendar.day), editing.dueDay, calendar.day)
        // (only sent when there is or was a deadline — see QuestsTab)
        await table.updateItem(editing.id, {
          title: form.title.trim(),
          notes: form.notes,
          ...((due_day !== null || editing.dueDay != null) && { due_day }),
        })
      }
      setEditing(null)
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function run(fn) {
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const toggleDone = (goal) =>
    run(() =>
      table.updateItem(
        goal.id,
        goal.status === 'Completed'
          ? { status: 'Active', completed_at: null }
          : { status: 'Completed', completed_at: new Date().toISOString() },
      ),
    )

  async function remove(goal) {
    if (!confirmDelete(`“${goal.title}”`)) return
    await run(() => table.removeItem(goal.id))
    setEditing(null)
  }

  const editingGoal = editing && editing !== 'new' ? goals.find((g) => g.id === editing.id) : null

  return (
    <section className={`party-goals party-goals--${kind}`}>
      <div className="party-goals__head">
        <div>
          <h3 className="party-goals__title">{title}</h3>
          {note && <p className="party-goals__note">{note}</p>}
        </div>
        <button type="button" className="btn btn--primary" onClick={() => open('new')}>
          + {addLabel}
        </button>
      </div>

      {loading && <p className="empty-state">Loading…</p>}
      {(error || actionError) && <p className="empty-state empty-state--error">{error || actionError}</p>}

      {!loading && !error && goals.length === 0 && (
        <p className="empty-state">{emptyText}</p>
      )}

      {goals.length > 0 && (
        <div className="goal-list">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => open(goal)}
              onSave={(patch) => table.updateItem(goal.id, patch)}
              onToggleDone={() => toggleDone(goal)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} label={editing === 'new' ? addLabel : `Edit ${addLabel.replace(/^Add /, '')}`}>
          <form className="goal-form panel" onSubmit={submit}>
            <div className="field">
              <label htmlFor={`goal-title-${kind}`}>Goal</label>
              <input
                id={`goal-title-${kind}`}
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Buy a ship of our own"
                required
              />
            </div>
            {editing === 'new' && (
              <div className="field">
                <label htmlFor={`goal-steps-${kind}`}>Subtasks (one per line)</label>
                <textarea
                  id={`goal-steps-${kind}`}
                  rows={4}
                  value={form.steps}
                  onChange={(e) => setForm({ ...form, steps: e.target.value })}
                  placeholder={'Save 2,000 gp\nFind a shipwright\nHire a crew'}
                />
              </div>
            )}
            <DueInField
              id={`goal-due-${kind}`}
              value={form.dueIn}
              onChange={(dueIn) => setForm((prev) => ({ ...prev, dueIn }))}
            />
            <div className="field">
              <label htmlFor={`goal-notes-${kind}`}>Notes</label>
              <RichTextEditor
                id={`goal-notes-${kind}`}
                value={form.notes}
                onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
                ariaLabel="Notes"
                placeholder="Why we want this…"
              />
            </div>
            {formError && <p className="empty-state empty-state--error">{formError}</p>}
            <div className="goal-form__actions">
              {editingGoal && (
                <button type="button" className="btn btn--danger form-delete" onClick={() => remove(editingGoal)}>
                  Delete
                </button>
              )}
              <button type="button" className="btn btn--text" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {editing === 'new' ? addLabel : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

// A slim row of the party's goals for Home and Session Mode: each with
// its ring and next subtask. Tapping one goes to the Party tab.
export function GoalStrip() {
  const { active } = usePartyGoals()
  const nav = useCampaignNav()
  // Fades the row's edges where more goals are scrolled out of view.
  const [listRef, fadeClass] = useEdgeFades()
  if (!active.length) return null
  return (
    <section className="goal-strip" aria-label="Party goals">
      <div className="goal-strip__head">
        <span className="goal-strip__label">
          <Icon name="target" /> Party goals
        </span>
        <button type="button" className="btn btn--text goal-strip__all" onClick={() => nav.goTo('party')}>
          All goals →
        </button>
      </div>
      <ul ref={listRef} className={`goal-strip__list ${fadeClass}`}>
        {active.map((goal) => {
          const next = nextStep(goal)
          return (
            <li key={goal.id}>
              <button type="button" className="goal-strip__goal panel" onClick={() => nav.goTo('party')}>
                <ProgressRing value={goalProgress(goal)} size={40} stroke={4} />
                <span className="goal-strip__text">
                  <strong>{goal.title}</strong>
                  <DeadlineBadge dueDay={goal.dueDay} />
                  <span>
                    {readyToComplete(goal) ? 'Every subtask done!' : next ? `Next: ${next.text}` : 'Add subtasks to track it'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// What the party as a whole wants, shared with everyone in the campaign.
function PartyGoals() {
  const { tables } = useCampaignData()
  return (
    <GoalBoard
      table={tables.goal}
      kind="party"
      title="Party Goals"
      addLabel="Add Party Goal"
      emptyText="No party goals yet. These are things the party as a whole wants — a ship, a keep, revenge — separate from quests handed to you by NPCs. Break each into subtasks and tick them off."
    />
  )
}

const NO_PLAYER = '00000000-0000-0000-0000-000000000000'

// The logged-in player's own goals. Only ever loaded for that player (by
// player_id), and kept out of the campaign index, so no one else sees
// them in the Party tab, search or the Connections web.
export function PersonalGoals() {
  const { campaignId, playerId } = useCampaignData()
  const table = useSupabaseTable('personal_goals', {
    filters: { campaign_id: campaignId, player_id: playerId || NO_PLAYER },
  })
  if (!playerId) return null
  return (
    <GoalBoard
      table={table}
      kind="personal"
      title="My Goals"
      addLabel="Add My Goal"
      note={
        <>
          <Icon name="lock" /> Only you can see these.
        </>
      }
      emptyText="Nothing here yet. What does your character want for themselves — a debt repaid, a rival beaten, a secret kept? Only you can see these goals."
    />
  )
}

export default PartyGoals
