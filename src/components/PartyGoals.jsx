import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { entityKey } from '../lib/entities.js'
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

// The entries linked to a goal (quests, NPCs, loot that help with it).
function useGoalLinks(goal) {
  const { links, byKey } = useCampaignData()
  return links
    .filter(
      (l) => (l.source_type === 'goal' && l.source_id === goal.id) || (l.target_type === 'goal' && l.target_id === goal.id),
    )
    .map((l) =>
      l.source_type === 'goal' && l.source_id === goal.id
        ? byKey.get(entityKey(l.target_type, l.target_id))
        : byKey.get(entityKey(l.source_type, l.source_id)),
    )
    .filter(Boolean)
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
  const nav = useCampaignNav()
  const linked = useGoalLinks(goal)
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

      {linked.length > 0 && (
        <ul className="goal-card__tags" aria-label="Linked">
          {linked.map((e) => (
            <li key={`${e.type}:${e.id}`}>
              <button type="button" className="goal-card__tag" onClick={() => nav.openEntity(e.type, e.id)}>
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {goal.notes && <RichText className="goal-card__notes" value={goal.notes} />}

      <footer className="goal-card__foot">
        <button
          type="button"
          className="goal-card__link-btn"
          aria-label={`Link ${goal.title} to a quest, NPC or item`}
          title="Link to a quest, NPC or item"
          onClick={() => nav.openEntity('goal', goal.id)}
        >
          <Icon name="link" />
        </button>
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

// What the party is working towards, as task cards: tick a goal off when
// it's done, and break it into subtasks.
function PartyGoals() {
  const { active, achieved, table, loading, error } = usePartyGoals()
  const [editing, setEditing] = useState(null) // goal | 'new' | null
  const [form, setForm] = useState({ title: '', notes: '', steps: '' })
  const [formError, setFormError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const goals = [...active, ...achieved]

  function open(goal) {
    setFormError(null)
    if (goal === 'new') setForm({ title: '', notes: '', steps: '' })
    else setForm({ title: goal.title, notes: goal.notes, steps: '' })
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
        await table.addItem({ title: form.title.trim(), notes: form.notes, steps, status: 'Active' })
      } else {
        await table.updateItem(editing.id, { title: form.title.trim(), notes: form.notes })
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
    <section className="party-goals">
      <div className="party-goals__head">
        <h3 className="party-goals__title">Party Goals</h3>
        <button type="button" className="btn btn--primary" onClick={() => open('new')}>
          + Add Party Goal
        </button>
      </div>

      {loading && <p className="empty-state">Loading…</p>}
      {(error || actionError) && <p className="empty-state empty-state--error">{error || actionError}</p>}

      {!loading && !error && goals.length === 0 && (
        <p className="empty-state">
          No party goals yet. These are things the party as a whole wants — a ship, a keep, revenge — separate from
          quests handed to you by NPCs. Break each into subtasks and tick them off.
        </p>
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
        <Modal onClose={() => setEditing(null)} label={editing === 'new' ? 'Add Party Goal' : 'Edit Party Goal'}>
          <form className="goal-form panel" onSubmit={submit}>
            <div className="field">
              <label htmlFor="goal-title">Goal</label>
              <input
                id="goal-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Buy a ship of our own"
                required
              />
            </div>
            {editing === 'new' && (
              <div className="field">
                <label htmlFor="goal-steps">Subtasks (one per line)</label>
                <textarea
                  id="goal-steps"
                  rows={4}
                  value={form.steps}
                  onChange={(e) => setForm({ ...form, steps: e.target.value })}
                  placeholder={'Save 2,000 gp\nFind a shipwright\nHire a crew'}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="goal-notes">Notes</label>
              <RichTextEditor
                id="goal-notes"
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
                {editing === 'new' ? 'Add Party Goal' : 'Save Changes'}
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
      <ul className="goal-strip__list">
        {active.map((goal) => {
          const next = nextStep(goal)
          return (
            <li key={goal.id}>
              <button type="button" className="goal-strip__goal panel" onClick={() => nav.goTo('party')}>
                <ProgressRing value={goalProgress(goal)} size={40} stroke={4} />
                <span className="goal-strip__text">
                  <strong>{goal.title}</strong>
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

export default PartyGoals
