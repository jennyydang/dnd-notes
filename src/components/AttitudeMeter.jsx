import { useState } from 'react'
import { ATTITUDES, attitudeChange, attitudeInfo, changeLabel, direction } from '../lib/attitude.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './AttitudeMeter.scss'

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// How an NPC feels about the party, as one small pill beside their life
// status ("● Wary"), or a faint "+ Rapport" until it's been judged. Tapping
// it opens a picker — Hostile to Ally, an optional reason, and the history
// of how they've warmed or cooled.
function AttitudeMeter({ npc, onSave }) {
  const [open, setOpen] = useState(false)
  const current = attitudeInfo(npc.attitude)

  return (
    <>
      <button
        type="button"
        className={`rapport-pill${current ? '' : ' rapport-pill--unset'}`}
        style={current ? { '--attitude': current.color } : undefined}
        onClick={() => onSave && setOpen(true)}
        disabled={!onSave}
        aria-label={current ? `Rapport with ${npc.name}: ${current.id}. Change` : `Set rapport with ${npc.name}`}
        title={current ? `${current.id} — ${current.hint}` : 'How do they feel about the party?'}
      >
        {current ? (
          <>
            <span className="rapport-pill__dot" aria-hidden="true" />
            {current.id}
          </>
        ) : (
          '+ Rapport'
        )}
      </button>
      {open && <RapportPicker npc={npc} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  )
}

function RapportPicker({ npc, onSave, onClose }) {
  const [choice, setChoice] = useState(npc.attitude || null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const log = Array.isArray(npc.attitudeLog) ? npc.attitudeLog : []
  const changed = choice && choice !== npc.attitude

  async function save(event) {
    event.preventDefault()
    const patch = changed && attitudeChange(npc, choice, note)
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
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} label={`Rapport with ${npc.name}`}>
      <form className="rapport" onSubmit={save}>
        <h3 className="rapport__title">How does {npc.name} feel about the party?</h3>
        <div className="rapport__options" role="radiogroup" aria-label="Rapport">
          {[...ATTITUDES].reverse().map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={choice === a.id}
              className={`rapport__option${choice === a.id ? ' is-chosen' : ''}`}
              style={{ '--attitude': a.color }}
              onClick={() => setChoice(a.id)}
            >
              <span className="rapport__dot" aria-hidden="true" />
              <span className="rapport__name">{a.id}</span>
              <span className="rapport__hint">{a.hint}</span>
              {npc.attitude === a.id && <span className="rapport__now">Now</span>}
            </button>
          ))}
        </div>
        {changed && (
          <div className="field">
            <label htmlFor="rapport-why">Why? (optional)</label>
            <input
              id="rapport-why"
              value={note}
              maxLength={160}
              onChange={(e) => setNote(e.target.value)}
              placeholder="We sank her nephew’s boat"
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
                <li key={i} className={`rapport__entry rapport__entry--${direction(entry)}`}>
                  <span className="rapport__change">{changeLabel(entry)}</span>
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

export default AttitudeMeter
