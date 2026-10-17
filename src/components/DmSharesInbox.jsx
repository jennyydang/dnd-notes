import { useEffect, useState } from 'react'
import { OPEN_DM_INBOX, useDmInbox } from '../hooks/useDmInbox.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { SHARE_KINDS, addShareToParty, shareDetail, shareImage, shareLabel } from '../lib/dmShares.js'
import { formatDateTime } from '../lib/sessionMode.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './DmSharesInbox.scss'
import { notesToPlainText } from '../lib/richNotes.js'

// Topbar bell: the player's notifications (feedback marked solved, and
// any other kind) and, inside a campaign for a non-DM player, what the DM
// has shared. The count covers unread notifications plus unhandled shares.
export function NotificationBell({ playerId, campaignId, dmShares = false }) {
  if (!playerId) return null
  return dmShares ? (
    <BellWithDmShares playerId={playerId} campaignId={campaignId} />
  ) : (
    <Bell playerId={playerId} campaignId={campaignId} inbox={null} />
  )
}

function BellWithDmShares({ playerId, campaignId }) {
  const inbox = useDmInbox(campaignId, playerId)
  // DM-share tables not created yet (SQL not run): leave that part out.
  return <Bell playerId={playerId} campaignId={campaignId} inbox={inbox.error ? null : inbox} />
}

function Bell({ playerId, campaignId, inbox }) {
  const [open, setOpen] = useState(false)
  const notes = useNotifications(playerId)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_DM_INBOX, show)
    return () => window.removeEventListener(OPEN_DM_INBOX, show)
  }, [])
  // Notifications table not created yet and no DM shares: nothing to show.
  if (notes.error && !inbox) return null
  const unread = notes.error ? 0 : notes.unread.length
  const count = unread + (inbox?.inbox.length || 0)

  function close() {
    setOpen(false)
    // Seen now; the count drops but they stay listed until dismissed.
    if (!notes.error) notes.markAllRead()
  }

  return (
    <>
      <button
        type="button"
        className={`dm-bell${count ? ' dm-bell--unread' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={count ? `${count} new notification${count === 1 ? '' : 's'}` : 'Notifications'}
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className="dm-bell__count" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <NotificationsPanel
          campaignId={campaignId}
          inbox={inbox}
          notes={notes.error ? null : notes}
          onClose={close}
        />
      )}
    </>
  )
}

function NotificationsPanel({ campaignId, inbox, notes, onClose }) {
  const nav = useCampaignNav()
  const [busyId, setBusyId] = useState(null)
  const [results, setResults] = useState({}) // shareId → message
  // Adding clears an item from the bell count right away, but it stays in
  // this list (with its result and an Open link) until the panel closes.
  const [kept] = useState(() => new Set((inbox?.inbox || []).map((s) => s.id)))
  const items = inbox
    ? inbox.latest.filter((s) => !inbox.dismissed.has(s.id) || (kept.has(s.id) && results[s.id]))
    : []
  const updates = notes?.items || []
  const empty = items.length === 0 && updates.length === 0

  async function add(share) {
    setBusyId(share.id)
    const { tabLabel } = SHARE_KINDS[share.kind]
    try {
      const outcome = await addShareToParty(share, campaignId)
      setResults((r) => ({
        ...r,
        [share.id]:
          outcome === 'added'
            ? { ok: true, text: `Added to ${tabLabel}!` }
            : outcome === 'already'
              ? { ok: true, text: `Already in ${tabLabel} — someone beat you to it.` }
              : { ok: false, gone: true, text: 'Your DM has removed this.' },
      }))
      if (outcome !== 'gone') inbox.dismiss(share)
    } catch (err) {
      setResults((r) => ({ ...r, [share.id]: { ok: false, text: `Couldn’t add it: ${err.message}` } }))
    } finally {
      setBusyId(null)
    }
  }

  function open(share) {
    onClose()
    nav.goTo(SHARE_KINDS[share.kind].tab)
  }

  return (
    <Modal onClose={onClose} label="Notifications" size={empty ? 'narrow' : undefined}>
      <div className="dm-inbox">
        <div className="dm-inbox__header">
          <h3 className="section-card__title dm-inbox__title">
            <Icon name="bell" /> Notifications
          </h3>
          <button type="button" className="dm-inbox__close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {empty && (
          <div className="dm-inbox__empty">
            <p className="dm-inbox__empty-title">You’re all caught up</p>
            <p>
              {inbox
                ? 'Shares from your DM and replies to your feedback will show up here.'
                : 'Replies to your feedback will show up here.'}
            </p>
          </div>
        )}
        {updates.length > 0 && (
          <ul className="dm-inbox__list" aria-label="Updates">
            {updates.map((note) => (
              <li key={note.id} className={`notice${note.readAt ? '' : ' notice--unread'}`}>
                <span className="notice__icon" aria-hidden="true">
                  <Icon name={note.kind === 'feedback_solved' ? 'check-square' : 'bell'} />
                </span>
                <div className="notice__body">
                  <span className="notice__title">{note.title}</span>
                  {note.body && <span className="notice__text">{note.body}</span>}
                  <span className="notice__time">{formatDateTime(note.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="notice__dismiss"
                  onClick={() => notes.dismiss(note.id).catch(() => {})}
                  aria-label={`Dismiss “${note.title}”`}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && updates.length > 0 && <h4 className="dm-inbox__section">From your DM</h4>}
        {items.length > 0 && (
          <ul className="dm-inbox__list">
            {items.map((share) => {
              const kind = SHARE_KINDS[share.kind]
              const added = inbox.isAdded(share)
              const result = results[share.id]
              const image = shareImage(share)
              const detail = shareDetail(share)
              const icon = kind.icon
              return (
                <li key={share.id} className={`dm-share dm-share--${share.kind}`}>
                  <div className="dm-share__thumb" aria-hidden="true">
                    {image ? <img src={image} alt="" /> : <Icon name={icon} size="1.6rem" />}
                  </div>
                  <div className="dm-share__body">
                    <span className="dm-share__kind">
                      <Icon name={icon} /> New {share.kind === 'art' ? 'art' : shareLabel(share)}
                      <span className="dm-share__time"> · {formatDateTime(share.createdAt)}</span>
                    </span>
                    <span className="dm-share__title">{share.title || 'Untitled'}</span>
                    {detail && <span className="dm-share__detail">{detail}</span>}
                    {['npc', 'creature'].includes(share.kind) && share.payload.description && (
                      <span className="dm-share__description">{notesToPlainText(share.payload.description)}</span>
                    )}
                    {result && (
                      <span className={`dm-share__result${result.ok ? '' : ' dm-share__result--error'}`} role="status">
                        {result.text}
                      </span>
                    )}
                    <div className="dm-share__actions">
                      {added ? (
                        <>
                          <span className="dm-share__added">✓ In {kind.tabLabel}</span>
                          <button type="button" className="btn btn--text" onClick={() => open(share)}>
                            Open {kind.tabLabel}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => add(share)}
                          disabled={busyId === share.id || Boolean(result?.gone)}
                        >
                          {busyId === share.id ? 'Adding…' : `+ Add to ${kind.tabLabel}`}
                        </button>
                      )}
                      {!result?.ok && (
                        <button
                          type="button"
                          className="btn btn--text dm-share__dismiss"
                          onClick={() => inbox.dismiss(share)}
                          aria-label={`Dismiss ${share.title || 'this'}`}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
