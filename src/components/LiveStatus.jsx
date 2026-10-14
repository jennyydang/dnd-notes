import { useState, useSyncExternalStore } from 'react'
import Icon from './Icon.jsx'
import { usePartyPresence } from '../hooks/usePartyPresence.js'
import { dismissFailed, getSyncStatus, subscribeSyncStatus } from '../lib/offline.js'
import './LiveStatus.scss'

const MAX_FACES = 3

const initial = (name) => (name.trim()[0] || '?').toUpperCase()

// Who else is in the campaign right now, as a row of initials.
export function PartyPresence({ campaignId, playerId, username }) {
  const others = usePartyPresence(campaignId, playerId, username)
  if (others.length === 0) return null
  const names = others.map((o) => o.username).join(', ')
  const shown = others.slice(0, MAX_FACES)
  const extra = others.length - shown.length
  return (
    <div className="party-presence" role="img" aria-label={`Here now: ${names}`} title={`Here now: ${names}`}>
      {shown.map((o) => (
        <span key={o.playerId} className="party-presence__face" aria-hidden="true">
          {initial(o.username)}
        </span>
      ))}
      {extra > 0 && (
        <span className="party-presence__face party-presence__face--more" aria-hidden="true">
          +{extra}
        </span>
      )}
    </div>
  )
}

// Offline / syncing / couldn't-save indicator. Says nothing while
// everything is saved and the connection is fine.
export function SyncStatus() {
  const { online, pending, syncing, failed } = useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
  const [showFailed, setShowFailed] = useState(false)

  if (failed.length > 0) {
    return (
      <div className="sync-status">
        <button
          type="button"
          className="sync-status__pill sync-status__pill--error"
          onClick={() => setShowFailed((v) => !v)}
          aria-expanded={showFailed}
        >
          <Icon name="alert" />
          {failed.length === 1 ? '1 change not saved' : `${failed.length} changes not saved`}
        </button>
        {showFailed && (
          <div className="sync-status__panel" role="dialog" aria-label="Changes that couldn’t be saved">
            <p>
              These were made offline, and the server turned them down when they were sent. Anything
              else you changed was saved.
            </p>
            <ul>
              {failed.map((f, i) => (
                <li key={i}>
                  <strong>{f.table.replace(/_/g, ' ')}</strong> ({f.kind}): {f.message}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn"
              onClick={() => {
                dismissFailed()
                setShowFailed(false)
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    )
  }

  let content = null
  if (!online) {
    content = (
      <>
        <Icon name="wifi-off" />
        {pending ? `Offline · ${pending} to sync` : 'Offline'}
      </>
    )
  } else if (pending || syncing) {
    content = (
      <>
        <Icon name="sync" className="sync-status__spin" />
        {pending ? `Syncing ${pending}…` : 'Syncing…'}
      </>
    )
  }

  return (
    <div className="sync-status" role="status">
      {content && (
        <span className={`sync-status__pill${online ? '' : ' sync-status__pill--offline'}`}>{content}</span>
      )}
    </div>
  )
}
