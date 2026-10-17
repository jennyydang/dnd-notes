import { useEffect, useState } from 'react'
import { SHARE_KINDS } from '../lib/dmShares.js'
import Icon from './Icon.jsx'
import './ShareStatus.scss'

const REVEALED_MS = 3000

// The DM's share control on an NPC / art / map / creature card:
// private → "Share" button; sent → waiting; added → where it went. With
// `onReveal`, a "Reveal now" button also pops it up full-screen for the
// players at the table (it resolves true once sent). Once `revealed`, the
// button gives way to a quiet "Revealed" tag.
function ShareStatus({ kind, status, onShare, onReveal, revealed = false, sharing = false, className = '' }) {
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

  let main
  if (status === 'added') {
    main = <span className={`share-status share-status--added ${className}`}>✓ In players’ {tabLabel}</span>
  } else if (status === 'sent') {
    main = (
      <span className={`share-status share-status--sent ${className}`} title="Players have been notified">
        <Icon name="send" /> Sent — waiting for a player to add
      </span>
    )
  } else {
    main = (
      <button type="button" className={`btn btn--primary share-status__button ${className}`} onClick={onShare} disabled={sharing}>
        {sharing ? 'Sharing…' : (
          <>
            <Icon name="send" /> Share
          </>
        )}
      </button>
    )
  }
  if (!onReveal) return main
  if (revealed && revealState !== 'done') {
    return (
      <>
        {main}
        <span className="share-status share-status--revealed">
          <Icon name="eye" /> Revealed
        </span>
      </>
    )
  }

  return (
    <>
      {main}
      <button
        type="button"
        className="btn share-status__reveal"
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
