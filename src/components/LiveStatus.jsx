import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Icon from './Icon.jsx'
import { usePartyPresence } from '../hooks/usePartyPresence.js'
import { dismissFailed, getSyncStatus, subscribeSyncStatus } from '../lib/offline.js'
import { usePlayerAvatar } from '../lib/profiles.js'
import './LiveStatus.scss'

const MAX_FACES = 3

const initial = (name) => (name.trim()[0] || '?').toUpperCase()

// Who else is in the campaign right now, as a row of initials. Hovering
// or focusing a face shows that player's name; clicking opens the full
// list. Faces pop in as people arrive, no reload needed.
export function PartyPresence({ campaignId, playerId, username }) {
  const myAvatar = usePlayerAvatar(playerId)
  const others = usePartyPresence(campaignId, playerId, username, myAvatar)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (others.length === 0) return null
  const shown = others.slice(0, MAX_FACES)
  const extra = others.length - shown.length
  const toggle = () => setOpen((v) => !v)

  return (
    <div className={`party-presence${open ? ' party-presence--open' : ''}`} ref={rootRef}>
      <div className="party-presence__faces" role="group" aria-label={`${others.length} here now`}>
        {shown.map((o) => (
          <button
            key={o.playerId}
            type="button"
            className="party-presence__face"
            onClick={toggle}
            aria-expanded={open}
            aria-label={`${o.username} is here now`}
          >
            {o.avatarUrl ? (
              <img className="party-presence__photo" src={o.avatarUrl} alt="" />
            ) : (
              <span aria-hidden="true">{initial(o.username)}</span>
            )}
            <span className="party-presence__tip" aria-hidden="true">
              {o.username}
            </span>
          </button>
        ))}
        {extra > 0 && (
          <button
            type="button"
            className="party-presence__face party-presence__face--more"
            onClick={toggle}
            aria-expanded={open}
            aria-label={`${extra} more here now`}
          >
            +{extra}
          </button>
        )}
      </div>
      {open && (
        <div className="party-presence__list" role="dialog" aria-label="Here now">
          <div className="party-presence__list-title">Here now</div>
          <ul>
            {others.map((o) => (
              <li key={o.playerId}>
                {o.avatarUrl ? (
                  <img className="party-presence__mini" src={o.avatarUrl} alt="" />
                ) : (
                  <span className="party-presence__dot" aria-hidden="true" />
                )}
                {o.username}
              </li>
            ))}
          </ul>
        </div>
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
