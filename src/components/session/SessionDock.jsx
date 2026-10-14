import { useEffect, useRef, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { useActiveSession } from '../../hooks/useActiveSession.js'
import { useQuickNotes } from '../../hooks/useQuickNotes.js'
import { formatTime } from '../../lib/sessionMode.js'
import QuickNoteInput from '../QuickNoteInput.jsx'
import EndSessionModal from './EndSessionModal.jsx'
import Icon from '../Icon.jsx'
import './SessionDock.scss'

const QUICK_ADD = [
  { type: 'npc', label: 'NPC', icon: 'user' },
  { type: 'place', label: 'Place', icon: 'pin' },
  { type: 'quest', label: 'Quest', icon: 'quest' },
  { type: 'clue', label: 'Clue', icon: 'search' },
]
const ENDED_MESSAGE_MS = 5000

// While a session is running, a small dock in the bottom-right corner of
// every other screen: jot quick notes, add an NPC/place/quest/clue, pause,
// or end the session without going back to Home or Session Mode.
function SessionDock({ hidden }) {
  const { campaignId, playerId } = useCampaignData()
  const nav = useCampaignNav()
  const [active, setActive] = useActiveSession(campaignId, playerId)
  const quickNotes = useQuickNotes()
  const [open, setOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  const [ended, setEnded] = useState(null)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!ended) return undefined
    const timer = setTimeout(() => setEnded(null), ENDED_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [ended])

  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      if (event.key === 'Escape' && !ending) {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, ending])

  if (hidden) return null
  if (!active) {
    return ended ? (
      <div className="session-dock" role="status">
        <p className="session-dock__ended">{ended}</p>
      </div>
    ) : null
  }

  const sessionNotes = quickNotes.notes.filter(
    (n) => !n.sessionNoteId && new Date(n.createdAt) >= new Date(active.startedAt),
  )
  const state = active.paused ? 'Paused' : 'Session in progress'

  return (
    <div className={`session-dock${open ? ' session-dock--open' : ''}`}>
      {open && (
        <section className="session-dock__panel panel" aria-label="Session quick add">
          <header className="session-dock__header">
            <p className="session-dock__state">
              <span className={`session-dock__dot${active.paused ? ' session-dock__dot--paused' : ''}`} aria-hidden="true" />
              {state} · since {formatTime(active.startedAt)}
            </p>
          </header>

          {quickNotes.enabled && (
            <QuickNoteInput
              idPrefix="session-dock-note"
              onAdd={quickNotes.add}
              placeholder="What just happened?"
              autoFocus
            />
          )}

          <div className="session-dock__quick" role="group" aria-label="Add to the journal">
            {QUICK_ADD.map((a) => (
              <button key={a.type} type="button" className="btn session-dock__quick-btn" onClick={() => nav.openQuickCreate(a.type)}>
                <Icon name={a.icon} /> {a.label}
              </button>
            ))}
          </div>

          <footer className="session-dock__footer">
            {quickNotes.enabled && (
              <span className="session-dock__count">
                {sessionNotes.length} note{sessionNotes.length === 1 ? '' : 's'} this session
              </span>
            )}
            <div className="session-dock__controls">
              <button type="button" className="btn" onClick={() => setActive({ ...active, paused: !active.paused })}>
                <Icon name={active.paused ? 'play' : 'pause'} /> {active.paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setEnding(true)}>
                ■ End
              </button>
            </div>
          </footer>
        </section>
      )}

      <button
        ref={toggleRef}
        type="button"
        className="session-dock__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Minimise session dock' : `${state}. Open quick add`}
      >
        <span className={`session-dock__dot${active.paused ? ' session-dock__dot--paused' : ''}`} aria-hidden="true" />
        <span className="session-dock__toggle-label">{active.paused ? 'Paused' : 'Session'}</span>
        <Icon name={open ? 'close' : 'feather'} />
      </button>

      {ending && (
        <EndSessionModal
          notes={sessionNotes}
          onClose={() => setEnding(false)}
          onEnded={(created) => {
            setActive(null)
            setEnding(false)
            setOpen(false)
            setEnded(
              created ? 'Session ended. Recap saved to Session Notes.' : 'Session ended. Your quick notes are still saved.',
            )
          }}
        />
      )}
    </div>
  )
}

export default SessionDock
