import { useEffect, useState } from 'react'
import { OPEN_DM_INBOX, useDmInbox } from '../hooks/useDmInbox.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { getPublicUrl } from '../lib/storage.js'
import { SHARE_KINDS, addShareToParty, shareLabel } from '../lib/dmShares.js'
import { formatDateTime } from '../lib/sessionMode.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './DmSharesInbox.scss'

// Topbar bell for players: what the DM has shared, with an unread count.
export function DmSharesBell({ campaignId, playerId }) {
  const [open, setOpen] = useState(false)
  const inbox = useDmInbox(campaignId, playerId)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_DM_INBOX, show)
    return () => window.removeEventListener(OPEN_DM_INBOX, show)
  }, [])
  const count = inbox.inbox.length
  // Tables not created yet (SQL not run): stay out of the way.
  if (inbox.error) return null
  return (
    <>
      <button
        type="button"
        className={`dm-bell${count ? ' dm-bell--unread' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={count ? `${count} new from your DM` : 'Shared by your DM'}
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className="dm-bell__count" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && <DmSharesPanel campaignId={campaignId} inbox={inbox} onClose={() => setOpen(false)} />}
    </>
  )
}

function shareImage(share) {
  const { bucket } = SHARE_KINDS[share.kind]
  if (!bucket) return ''
  const path = share.kind === 'npc' ? share.payload.photo_path : share.payload.image_path
  return getPublicUrl(bucket, path)
}

function shareDetail(share) {
  const p = share.payload
  if (share.kind === 'npc') return [p.race, p.location].filter(Boolean).join(' · ')
  if (share.kind === 'art') return p.category || ''
  if (share.kind === 'creature') {
    const stats = [p.challenge && `CR ${p.challenge}`, p.armor_class != null && `AC ${p.armor_class}`, p.hit_points != null && `HP ${p.hit_points}`]
    return [p.creature_type, ...stats].filter(Boolean).join(' · ')
  }
  return ''
}

function DmSharesPanel({ campaignId, inbox, onClose }) {
  const nav = useCampaignNav()
  const [busyId, setBusyId] = useState(null)
  const [results, setResults] = useState({}) // shareId → message
  // Adding clears an item from the bell count right away, but it stays in
  // this list (with its result and an Open link) until the panel closes.
  const [kept] = useState(() => new Set(inbox.inbox.map((s) => s.id)))
  const items = inbox.latest.filter((s) => !inbox.dismissed.has(s.id) || (kept.has(s.id) && results[s.id]))

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
    <Modal onClose={onClose} label="Shared by your DM" size={items.length === 0 ? 'narrow' : undefined}>
      <div className="dm-inbox">
        <div className="dm-inbox__header">
          <h3 className="section-card__title dm-inbox__title">
            <Icon name="bell" /> From your DM
          </h3>
          <button type="button" className="dm-inbox__close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="dm-inbox__empty">
            <p className="dm-inbox__empty-title">Nothing new</p>
            <p>When your DM shares an NPC, art or a map, it’ll show up here.</p>
          </div>
        ) : (
          <ul className="dm-inbox__list">
            {items.map((share) => {
              const kind = SHARE_KINDS[share.kind]
              const added = inbox.isAdded(share)
              const result = results[share.id]
              const image = shareImage(share)
              const detail = shareDetail(share)
              const icon = share.kind === 'creature' && share.payload.kind === 'Creature' ? 'creature' : kind.icon
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
                      <span className="dm-share__description">{share.payload.description}</span>
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
