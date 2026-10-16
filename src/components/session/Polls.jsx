import { useEffect, useRef, useState } from 'react'
import { usePolls } from '../../hooks/usePolls.js'
import { MAX_POLL_OPTIONS, leaders, tallyPoll } from '../../lib/polls.js'
import { confirmDelete } from '../../lib/confirm.js'
import AnimatedNumber from '../AnimatedNumber.jsx'
import { SectionCard } from '../ui.jsx'
import Icon from '../Icon.jsx'
import './Polls.scss'

// One poll: tap a choice to vote (tap another to change). Bars grow as
// votes come in from around the table; once it's closed the winner glows.
export function PollCard({ poll, polls, compact = false, onVoted }) {
  const tally = tallyPoll(poll, polls.votes)
  const total = tally.reduce((sum, t) => sum + t.count, 0)
  const mine = polls.myVote(poll)
  const open = poll.status === 'open'
  const won = open ? [] : leaders(tally).map((t) => t.index)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`poll${open ? '' : ' poll--closed'}${compact ? ' poll--compact' : ''}`}>
      <header className="poll__head">
        <h4 className="poll__question">{poll.question}</h4>
        <span className="poll__meta">
          {open ? 'Voting' : 'Decided'} · {total} {total === 1 ? 'vote' : 'votes'}
          {poll.createdByName && ` · asked by ${poll.createdByName}`}
        </span>
      </header>
      <ul className="poll__options">
        {tally.map((t) => {
          const chosen = mine?.optionIndex === t.index
          return (
            <li key={t.index}>
              <button
                type="button"
                className={`poll__option${chosen ? ' is-mine' : ''}${won.includes(t.index) ? ' is-winner' : ''}`}
                disabled={!open || !polls.canVote || busy}
                aria-pressed={open ? chosen : undefined}
                onClick={() =>
                  run(async () => {
                    await polls.vote(poll, t.index)
                    onVoted?.()
                  })
                }
              >
                <span className="poll__bar" style={{ transform: `scaleX(${t.share})` }} aria-hidden="true" />
                <span className="poll__label">
                  {chosen && <Icon name="check" />}
                  {won.includes(t.index) && <Icon name="crown" />}
                  {t.label}
                </span>
                <span className="poll__count">
                  <AnimatedNumber value={t.count} />
                  <span className="poll__share">{Math.round(t.share * 100)}%</span>
                </span>
              </button>
              {!compact && t.voters.length > 0 && <p className="poll__voters">{t.voters.join(', ')}</p>}
            </li>
          )
        })}
      </ul>
      {open && !polls.canVote && <p className="field-hint">Only players can vote.</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!compact && polls.canManage(poll) && (
        <div className="poll__actions">
          {open ? (
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => polls.close(poll))}>
              <Icon name="check-square" /> Close vote
            </button>
          ) : (
            <button type="button" className="btn btn--text" disabled={busy} onClick={() => run(() => polls.reopen(poll))}>
              Reopen
            </button>
          )}
          <button
            type="button"
            className="btn btn--text poll__delete"
            disabled={busy}
            onClick={() => confirmDelete(`the vote “${poll.question}”`) && run(() => polls.remove(poll))}
          >
            Delete
          </button>
        </div>
      )}
      {!open && !compact && <p className="poll__saved">Saved to everyone’s notes for the recap.</p>}
    </article>
  )
}

function NewPollForm({ polls, onDone }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const first = useRef(null)
  useEffect(() => first.current?.focus(), [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await polls.create(question, options)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="poll-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="poll-question">Question</label>
        <input
          id="poll-question"
          ref={first}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="River or the mountain pass?"
          maxLength={200}
        />
      </div>
      <fieldset className="poll-form__options">
        <legend>Choices</legend>
        {options.map((option, i) => (
          <div key={i} className="poll-form__option">
            <input
              value={option}
              aria-label={`Choice ${i + 1}`}
              placeholder={`Choice ${i + 1}`}
              maxLength={80}
              onChange={(e) => setOptions((all) => all.map((o, j) => (j === i ? e.target.value : o)))}
            />
            {options.length > 2 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove choice ${i + 1}`}
                onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        ))}
        {options.length < MAX_POLL_OPTIONS && (
          <button type="button" className="btn btn--text" onClick={() => setOptions((all) => [...all, ''])}>
            + Add a choice
          </button>
        )}
      </fieldset>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn--text" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Starting…' : 'Start vote'}
        </button>
      </div>
    </form>
  )
}

// Session Mode's "Vote" panel: put a question to the table, see it decided.
export function PollsPanel() {
  const polls = usePolls()
  const [creating, setCreating] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const open = polls.polls.filter((p) => p.status === 'open')
  const past = polls.polls.filter((p) => p.status === 'closed')

  return (
    <SectionCard
      title="Party vote"
      icon="vote"
      className="polls-panel"
      action={
        !creating && (
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            + New vote
          </button>
        )
      }
    >
      {creating && <NewPollForm polls={polls} onDone={() => setCreating(false)} />}
      {polls.error && <p className="field-error">{polls.error}</p>}
      {!creating && !open.length && !polls.loading && (
        <p className="inline-state">Can’t agree? Put it to a vote — everyone’s phone shows it straight away.</p>
      )}
      {open.map((poll) => (
        <PollCard key={poll.id} poll={poll} polls={polls} />
      ))}
      {past.length > 0 && (
        <div className="polls-panel__past">
          <button type="button" className="btn btn--text" aria-expanded={showPast} onClick={() => setShowPast((s) => !s)}>
            {showPast ? 'Hide' : 'Show'} past votes ({past.length})
          </button>
          {showPast && past.slice(0, 10).map((poll) => <PollCard key={poll.id} poll={poll} polls={polls} />)}
        </div>
      )}
    </SectionCard>
  )
}

const DISMISSED_KEY = 'dnd-notes-dismissed-polls'
const readDismissed = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')
  } catch {
    return []
  }
}

// On every screen: a new vote you haven't answered pops up so you can vote
// without leaving what you're doing. After voting it shows the live
// results for a moment, then tucks itself away.
export function PollPopup({ onSessionTab = false }) {
  const polls = usePolls()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [justVoted, setJustVoted] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const pending = polls.canVote
    ? polls.polls.find(
        (p) => p.status === 'open' && p.createdBy !== polls.playerId && !polls.myVote(p) && !dismissed.includes(p.id),
      )
    : null
  const poll = polls.polls.find((p) => p.id === justVoted) || pending
  // Session Mode on a wide screen already shows its Vote panel.
  const hidden = onSessionTab && window.matchMedia?.('(min-width: 721px)').matches
  if (hidden || !poll) return null

  function dismiss(id) {
    clearTimeout(timer.current)
    setJustVoted(null)
    setDismissed((all) => {
      const next = [...all, id]
      try {
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
      } catch {
        // private mode: it just comes back next visit
      }
      return next
    })
  }

  return (
    <div className="poll-popup panel" role="dialog" aria-label="Party vote">
      <div className="poll-popup__top">
        <span className="poll-popup__kicker">
          <Icon name="vote" /> {justVoted ? 'Vote cast' : 'The party is voting'}
        </span>
        <button type="button" className="icon-btn" aria-label="Hide vote" onClick={() => dismiss(poll.id)}>
          <Icon name="close" />
        </button>
      </div>
      <PollCard
        poll={poll}
        polls={polls}
        compact
        onVoted={() => {
          setJustVoted(poll.id)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => dismiss(poll.id), 3500)
        }}
      />
    </div>
  )
}
