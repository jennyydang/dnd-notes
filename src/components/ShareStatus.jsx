import { SHARE_KINDS } from '../lib/dmShares.js'
import Icon from './Icon.jsx'
import './ShareStatus.scss'

// The DM's share control on an NPC / art / map card:
// private → "Share" button; sent → waiting; added → where it went.
function ShareStatus({ kind, status, onShare, sharing = false, className = '' }) {
  const { tabLabel } = SHARE_KINDS[kind]
  if (status === 'added') {
    return <span className={`share-status share-status--added ${className}`}>✓ In players’ {tabLabel}</span>
  }
  if (status === 'sent') {
    return (
      <span className={`share-status share-status--sent ${className}`} title="Players have been notified">
        <Icon name="send" /> Sent — waiting for a player to add
      </span>
    )
  }
  return (
    <button type="button" className={`btn btn--primary share-status__button ${className}`} onClick={onShare} disabled={sharing}>
      {sharing ? 'Sharing…' : (
        <>
          <Icon name="send" /> Share
        </>
      )}
    </button>
  )
}

export default ShareStatus
