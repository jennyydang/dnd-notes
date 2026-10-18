import { useEffect, useState } from 'react'
import { SHARE_KINDS } from '../lib/dmShares.js'
import Icon from './Icon.jsx'
import './ShareStatus.scss'

const REVEALED_MS = 3000

// The DM's reveal control on an NPC / art / map / creature card. "Reveal
// now" pops it up full-screen for the players and puts it in their
// notifications to add (`onReveal` resolves true once sent). After that it
// shows where it went: sent → waiting for a player to add; added → which
// tab it's in. Once `revealed`, the button gives way to a "Revealed" tag.
function ShareStatus({ kind, status, onReveal, revealed = false, sharing = false, className = '' }) {
  const { tabLabel } = SHARE_KINDS[kind]
  const [revealState, setRevealState] = useState(null) // null | 'sending' | 'done'

  useEffect(() => {
    if (revealState !== 'done') return undefined
    const timer = setTimeout(() => setRevealState(null), REVEALED_MS)
    return () => clearTimeout(timer)
  }, [revealState])

  async function reveal() {
    setRevealState('sending')
    const ok = await onReveal()
    setRevealState(ok ? 'done' : null)
  }

  let main = null
  if (status === 'added') {
    main = <span className={`share-status share-status--added ${className}`}>✓ In players’ {tabLabel}</span>
  } else if (status === 'sent') {
    main = (
      <span className={`share-status share-status--sent ${className}`} title="Players have been notified">
        <Icon name="send" /> Sent — waiting for a player to add
      </span>
    )
  }
  // Once it's out, one tag says so: where it went, or just "Revealed".
  if (revealed && revealState !== 'done') {
    return (
      main || (
        <span className="share-status share-status--revealed">
          <Icon name="eye" /> Revealed
        </span>
      )
    )
  }

  return (
    <>
      {main}
      <button
        type="button"
        className="btn btn--primary share-status__reveal"
        onClick={reveal}
        disabled={revealState === 'sending' || sharing}
        title="Show it full-screen on every player's device right now"
      >
        <Icon name="eye" />{' '}
        {revealState === 'sending' ? 'Revealing…' : revealState === 'done' ? 'Revealed to the table' : 'Reveal now'}
      </button>
    </>
  )
}

export default ShareStatus
