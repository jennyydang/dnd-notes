import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Icon from './Icon.jsx'
import { dismissFailed, getSyncStatus, subscribeSyncStatus } from '../lib/offline.js'
import './LiveStatus.scss'

const MAX_FACES = 3

const initial = (name) => (name.trim()[0] || '?').toUpperCase()

// One person's face: their photo or initial, ringed in their own colour.
function Face({ person, className = '' }) {
  return (
    <span className={`presence-face ${className}`} style={{ '--who': person.color }} aria-hidden="true">
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initial(person.username)}
    </span>
  )
}

// Who else is in the campaign right now (`people` from usePartyPresence),
// as a row of faces, each in that person's colour. Hovering or focusing a
// face shows their name and the page they're on; clicking opens the full
// list. Faces pop in as people arrive, no reload needed.
export function PartyPresence({ people }) {
  const others = people.filter((p) => !p.me)
  const me = people.find((p) => p.me)
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
            aria-label={`${o.username} is here now${o.tabLabel ? `, on ${o.tabLabel}` : ''}`}
          >
            <Face person={o} />
            <span className="party-presence__tip" aria-hidden="true">
              {o.username}
              {o.tabLabel && <span className="party-presence__where">{o.tabLabel}</span>}
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
          <div className="party-presence__list-title">Here now · {people.length}</div>
          <ul>
            {[...(me ? [me] : []), ...others].map((o) => (
              <li key={o.playerId}>
                <Face person={o} className="presence-face--mini" />
                <span className="party-presence__who">
                  {o.me ? 'You' : o.username}
                  {o.tabLabel && <span className="party-presence__where">{o.tabLabel}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// "Aria and Bram are here too" over the page you're on, when others in
// the campaign have the same page open — each in their own colour.
export function HereToo({ people, tab }) {
  const here = people.filter((p) => !p.me && p.tab === tab)
  if (here.length === 0) return null
  return (
    <div className="here-too" role="status">
      <span className="here-too__faces">
        {here.slice(0, 4).map((p) => (
          <Face key={p.playerId} person={p} className="presence-face--small" />
        ))}
      </span>
      <span>
        {here.map((p, i) => (
          <span key={p.playerId}>
            {i > 0 && (i === here.length - 1 ? ' and ' : ', ')}
            <strong style={{ color: p.color }}>{p.username}</strong>
          </span>
        ))}{' '}
        {here.length === 1 ? 'is' : 'are'} here too
      </span>
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
