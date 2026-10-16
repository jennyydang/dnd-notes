import { useState } from 'react'
import { ATTITUDES, attitudeChange, attitudeInfo, changeLabel, direction } from '../lib/attitude.js'
import Icon from './Icon.jsx'
import './AttitudeMeter.scss'

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// How an NPC feels about the party: five steps from Hostile to Ally. Tap a
// step to move them there (with an optional reason); the history of how
// they've warmed or cooled is kept underneath.
function AttitudeMeter({ npc, onSave, compact = false }) {
  const [picking, setPicking] = useState(null) // attitude id waiting for a reason
  const [note, setNote] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [error, setError] = useState(null)
  const current = attitudeInfo(npc.attitude)
  const log = Array.isArray(npc.attitudeLog) ? npc.attitudeLog : []

  async function save(to) {
    const patch = attitudeChange(npc, to, note)
    setPicking(null)
    setNote('')
    if (!patch) return
    setError(null)
    try {
      await onSave(patch)
    } catch (err) {
      setError(err.message)
    }
  }

  if (compact) {
    return current ? (
      <span className="attitude-chip" style={{ '--attitude': current.color }} title={`${npc.name}: ${current.id}`}>
        {current.id}
      </span>
    ) : null
  }

  return (
    <div className="attitude">
      <div className="attitude__head">
        <span className="attitude__label">Towards us</span>
        <span className="attitude__now" style={current ? { color: current.color } : undefined}>
          {current ? current.id : 'Not sure yet'}
        </span>
      </div>
      <div className="attitude__track" role="radiogroup" aria-label={`How ${npc.name} feels about the party`}>
        {ATTITUDES.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={npc.attitude === a.id}
            aria-label={a.id}
            title={`${a.id} — ${a.hint}`}
            className={`attitude__step${npc.attitude === a.id ? ' is-on' : ''}${picking === a.id ? ' is-picking' : ''}`}
            style={{ '--attitude': a.color }}
            onClick={() => {
              if (npc.attitude === a.id) return
              setPicking(a.id)
              setNote('')
            }}
          />
        ))}
      </div>
      {picking && (
        <form
          className="attitude__why"
          onSubmit={(e) => {
            e.preventDefault()
            save(picking)
          }}
        >
          <input
            autoFocus
            value={note}
            maxLength={160}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setPicking(null)}
            placeholder={`Why ${picking.toLowerCase()}? (optional)`}
            aria-label={`Why ${npc.name} is now ${picking}`}
          />
          <button type="submit" className="btn">
            Set
          </button>
          <button type="button" className="btn btn--text" onClick={() => setPicking(null)}>
            Cancel
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}
      {log.length > 0 && (
        <>
          <button type="button" className="attitude__log-toggle" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
            <Icon name="hourglass" /> {showLog ? 'Hide' : 'How it changed'} ({log.length})
          </button>
          {showLog && (
            <ol className="attitude__log">
              {[...log].reverse().map((entry, i) => (
                <li key={i} className={`attitude__entry attitude__entry--${direction(entry)}`}>
                  <span className="attitude__change">{changeLabel(entry)}</span>
                  {entry.note && <span className="attitude__note">{entry.note}</span>}
                  <time dateTime={entry.at}>{when(entry.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}

export default AttitudeMeter
