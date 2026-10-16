import { useEffect, useRef, useState } from 'react'
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

const CELEBRATE_MS = 1600

// The party's goals, shared by the Party tab and the Home / Session strip.
function usePartyGoals() {
  const { tables } = useCampaignData()
  const table = tables.goal
  const goals = table.items.map(goalFromRow)
  return { ...sortGoals(goals), table, loading: table.loading, error: table.error }
}

// A ring that fills with the goal's progress.
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

function StepList({ goal, onSave }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)

  async function save(steps) {
    setError(null)
    try {
      await onSave(steps)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="goal-steps">
      <ul className="goal-steps__list">
        {goal.steps.map((step) => (
          <li key={step.id} className={`goal-steps__item${step.done ? ' is-done' : ''}`}>
            <button
              type="button"
              className="goal-steps__check"
              role="checkbox"
              aria-checked={step.done}
              aria-label={step.text}
              onClick={() => {
                navigator.vibrate?.(10)
                save(toggleStep(goal.steps, step.id))
              }}
            >
              {step.done && <Icon name="check" />}
            </button>
            <input
              className="goal-steps__text"
              defaultValue={step.text}
              aria-label="Step"
              onBlur={(e) => {
                const text = e.target.value.trim()
                if (!text) e.target.value = step.text
                else if (text !== step.text) save(renameStep(goal.steps, step.id, text))
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
              className="icon-btn goal-steps__remove"
              aria-label={`Remove step “${step.text}”`}
              onClick={() => save(removeStep(goal.steps, step.id))}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="goal-steps__add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          save([...goal.steps, newStep(draft)])
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={goal.steps.length ? 'Add a step…' : 'Break it into steps — e.g. “Save 2,000 gp”'}
          aria-label={`Add a step to ${goal.title}`}
          maxLength={160}
        />
        <button type="submit" className="btn btn--text" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function GoalCard({ goal, celebrating, onEdit, onAchieve, onSaveSteps }) {
  const nav = useCampaignNav()
  const linked = useGoalLinks(goal)
  const progress = goalProgress(goal)
  const done = goal.steps.filter((s) => s.done).length
  const ready = readyToComplete(goal)

  return (
    <article className={`goal-card panel${celebrating ? ' is-celebrating' : ''}${ready ? ' is-ready' : ''}`}>
      {celebrating && (
        <span className="goal-card__stamp" aria-hidden="true">
          Achieved
        </span>
      )}
      <header className="goal-card__head">
        <ProgressRing value={celebrating ? 1 : progress} />
        <div className="goal-card__heading">
          <h4 className="goal-card__title">{goal.title}</h4>
          <span className="goal-card__count">
            {goal.steps.length ? `${done} of ${goal.steps.length} steps` : 'No steps yet'}
          </span>
        </div>
      </header>

      <StepList goal={goal} onSave={onSaveSteps} />

      {goal.notes && <RichText className="goal-card__notes" value={goal.notes} />}

      {linked.length > 0 && (
        <ul className="goal-card__links" aria-label="Helps with this goal">
          {linked.map((e) => (
            <li key={`${e.type}:${e.id}`}>
              <button type="button" className="chip goal-card__link" onClick={() => nav.openEntity(e.type, e.id)}>
                <Icon name={e.icon} /> {e.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="goal-card__actions">
        <button
          type="button"
          className={`btn${ready ? ' btn--primary' : ' btn--text'} goal-card__achieve`}
          onClick={onAchieve}
        >
          <Icon name="crown" /> {ready ? 'Mark achieved!' : 'Achieved'}
        </button>
        <button type="button" className="btn btn--text" onClick={() => nav.openEntity('goal', goal.id)}>
          <Icon name="link" /> Link
        </button>
        <button type="button" className="btn btn--text goal-card__edit" onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  )
}

// What the party is working towards: goals broken into steps, each with
// a ring that fills as steps are ticked off. Achieved goals move to the
// trophy shelf.
function PartyGoals() {
  const { active, achieved, table, loading, error } = usePartyGoals()
  const [editing, setEditing] = useState(null) // goal | 'new' | null
  const [form, setForm] = useState({ title: '', notes: '', steps: '' })
  const [formError, setFormError] = useState(null)
  const [celebrating, setCelebrating] = useState(() => new Set())
  const [actionError, setActionError] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // A goal mid-celebration stays on the board until its stamp has landed.
  const allGoals = [...active, ...achieved]
  const board = [...active, ...achieved.filter((g) => celebrating.has(g.id))]
  const shelf = achieved.filter((g) => !celebrating.has(g.id))

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

  function achieve(goal) {
    run(async () => {
      navigator.vibrate?.([30, 40, 60])
      setCelebrating((s) => new Set(s).add(goal.id))
      timers.current.push(
        setTimeout(
          () =>
            setCelebrating((s) => {
              const next = new Set(s)
              next.delete(goal.id)
              return next
            }),
          CELEBRATE_MS,
        ),
      )
      await table.updateItem(goal.id, { status: 'Completed', completed_at: new Date().toISOString() })
    })
  }

  async function remove(goal) {
    if (!confirmDelete(`“${goal.title}”`)) return
    await run(() => table.removeItem(goal.id))
    setEditing(null)
  }

  const editingGoal = editing && editing !== 'new' ? allGoals.find((g) => g.id === editing.id) : null

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

      {!loading && !error && allGoals.length === 0 && (
        <p className="empty-state">
          No party goals yet. These are things the party as a whole wants — a ship, a keep, revenge — separate from
          quests handed to you by NPCs. Break each into steps and watch it fill up.
        </p>
      )}

      {board.length > 0 && (
        <div className="goal-list">
          {board.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              celebrating={celebrating.has(goal.id)}
              onEdit={() => open(goal)}
              onAchieve={() => achieve(goal)}
              onSaveSteps={(steps) => table.updateItem(goal.id, { steps })}
            />
          ))}
        </div>
      )}

      {shelf.length > 0 && (
        <div className="goal-shelf">
          <h4 className="goal-shelf__title">
            <Icon name="crown" /> Achieved
          </h4>
          <ul className="goal-shelf__list">
            {shelf.map((goal) => (
              <li key={goal.id}>
                <button type="button" className="goal-trophy" onClick={() => open(goal)}>
                  <span className="goal-trophy__icon" aria-hidden="true">
                    <Icon name="crown" />
                  </span>
                  <span className="goal-trophy__title">{goal.title}</span>
                  {goal.completedAt && (
                    <span className="goal-trophy__date">
                      {new Date(goal.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
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
                <label htmlFor="goal-steps">Steps (one per line)</label>
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
              {editingGoal?.status === 'Completed' && (
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() =>
                    run(async () => {
                      await table.updateItem(editingGoal.id, { status: 'Active', completed_at: null })
                      setEditing(null)
                    })
                  }
                >
                  Not achieved yet
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
// its ring and next step. Tapping one goes to the Party tab.
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
                    {readyToComplete(goal) ? 'Every step done!' : next ? `Next: ${next.text}` : 'Add steps to track it'}
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
