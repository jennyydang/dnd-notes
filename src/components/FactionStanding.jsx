import { useState } from 'react'
import { STANDINGS, standingChange, standingChangeLabel, standingDirection, standingInfo } from '../lib/standing.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './AttitudeMeter.scss'
import './FactionStanding.scss'

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// The party's standing with a faction, as a seven-notch track from Hated
// to Revered with the current notch lit ("Friendly"), or a faint
// "+ Standing" until it's set. Tapping it opens the picker: the seven
// levels, an optional reason, and the history of how it's moved.
function FactionStanding({ faction, onSave }) {
  const [open, setOpen] = useState(false)
  const current = standingInfo(faction.standing)

  return (
    <>
      <button
        type="button"
        className={`standing${current ? '' : ' standing--unset'}`}
        style={current ? { '--attitude': current.color } : undefined}
        onClick={() => onSave && setOpen(true)}
        disabled={!onSave}
        aria-label={
          current ? `Standing with ${faction.title}: ${current.id}. Change` : `Set the party’s standing with ${faction.title}`
        }
        title={current ? `${current.id} — ${current.hint}` : 'How does this faction see the party?'}
      >
        {current ? (
          <>
            <span className="standing__track" aria-hidden="true">
              {STANDINGS.map((s) => (
                <span
                  key={s.value}
                  className={`standing__notch${s.value === current.value ? ' is-current' : ''}${
                    s.value !== 0 && Math.sign(s.value) === Math.sign(current.value) && Math.abs(s.value) <= Math.abs(current.value)
                      ? ' is-filled'
                      : ''
                  }`}
                />
              ))}
            </span>
            <span className="standing__label">{current.id}</span>
          </>
        ) : (
          '+ Standing'
        )}
      </button>
      {open && <StandingPicker faction={faction} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  )
}

function StandingPicker({ faction, onSave, onClose }) {
  const [choice, setChoice] = useState(faction.standing ?? null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const log = Array.isArray(faction.standingLog) ? faction.standingLog : []
  const changed = choice !== null && choice !== (faction.standing ?? null)

  async function save(event) {
    event.preventDefault()
    const patch = changed && standingChange(faction, choice, note)
    if (!patch) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(patch)
      onClose()
    } catch (err) {
      setError(/standing/.test(err.message) ? `${err.message} — run the latest supabase/schema.sql.` : err.message)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} label={`Standing with ${faction.title}`}>
      <form className="rapport" onSubmit={save}>
        <h3 className="rapport__title">How does {faction.title} see the party?</h3>
        <div className="rapport__options" role="radiogroup" aria-label="Standing">
          {[...STANDINGS].reverse().map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={choice === s.value}
              className={`rapport__option${choice === s.value ? ' is-chosen' : ''}`}
              style={{ '--attitude': s.color }}
              onClick={() => setChoice(s.value)}
            >
              <span className="rapport__dot" aria-hidden="true" />
              <span className="rapport__name">
                {s.id} <span className="standing__value">{s.value > 0 ? `+${s.value}` : s.value === 0 ? '0' : `−${-s.value}`}</span>
              </span>
              <span className="rapport__hint">{s.hint}</span>
              {faction.standing === s.value && <span className="rapport__now">Now</span>}
            </button>
          ))}
        </div>
        {changed && (
          <div className="field">
            <label htmlFor="standing-why">Why? (optional)</label>
            <input
              id="standing-why"
              value={note}
              maxLength={160}
              onChange={(e) => setNote(e.target.value)}
              placeholder="We returned their stolen ledger"
            />
          </div>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !changed}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {log.length > 0 && (
          <section className="rapport__history">
            <h4>
              <Icon name="hourglass" /> How it’s changed
            </h4>
            <ol>
              {[...log].reverse().map((entry, i) => (
                <li key={i} className={`rapport__entry rapport__entry--${standingDirection(entry)}`}>
                  <span className="rapport__change">{standingChangeLabel(entry)}</span>
                  <time dateTime={entry.at}>{when(entry.at)}</time>
                  {entry.note && <span className="rapport__note">{entry.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </form>
    </Modal>
  )
}

export default FactionStanding
