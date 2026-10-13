import { useEffect, useMemo, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { useDmShares } from '../hooks/useDmShares.js'
import { useCampaignNav } from '../hooks/useCampaignData.js'
import { getPublicUrl } from '../lib/storage.js'
import { SHARE_KINDS, addShareToParty, shareKey } from '../lib/dmShares.js'
import { formatDateTime } from '../lib/sessionMode.js'
import Modal from './Modal.jsx'
import './DmSharesInbox.scss'

// No realtime subscription in this app, so check for new shares now and
// then, and whenever the player comes back to the tab.
const POLL_MS = 45000

const dismissalFromRow = (r) => ({ id: r.id, shareId: r.share_id })
const npcLinkFromRow = (r) => ({ id: r.id, dmNpcId: r.dm_npc_id })
const mapLinkFromRow = (r) => ({ id: r.id, dmMapId: r.dm_map_id })
const artFromRow = (r) => ({ id: r.id, shared: r.shared })

function useDmInbox(campaignId, playerId) {
  const { shares, byKey, error, refetch } = useDmShares(campaignId)
  const dismissals = useSupabaseTable('dm_share_dismissals', {
    fromRow: dismissalFromRow,
    filters: { player_id: playerId },
  })
  const campaignFilter = { campaign_id: campaignId }
  const npcs = useSupabaseTable('npcs', { fromRow: npcLinkFromRow, filters: campaignFilter })
  const maps = useSupabaseTable('maps', { fromRow: mapLinkFromRow, filters: campaignFilter })
  const art = useSupabaseTable('campaign_art', { fromRow: artFromRow, filters: campaignFilter })

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        refetch({ silent: true })
        npcs.refetch({ silent: true })
        maps.refetch({ silent: true })
        art.refetch({ silent: true })
      }
    }
    const timer = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
    // The refetch functions are stable per table; re-subscribing on every
    // render would reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  const dismissed = useMemo(() => new Set(dismissals.items.map((d) => d.shareId)), [dismissals.items])
  const added = useMemo(
    () => ({
      npc: new Set(npcs.items.map((n) => n.dmNpcId).filter(Boolean)),
      map: new Set(maps.items.map((m) => m.dmMapId).filter(Boolean)),
      art: new Set(art.items.filter((a) => a.shared).map((a) => a.id)),
    }),
    [npcs.items, maps.items, art.items],
  )

  // Only the latest share of each item; `inbox` drops the ones this player
  // has dealt with (added or dismissed).
  const latest = shares.filter((s) => byKey.get(shareKey(s.kind, s.sourceId)) === s)
  const inbox = latest.filter((s) => !dismissed.has(s.id))
  const isAdded = (share) => added[share.kind]?.has(share.sourceId) || false

  async function dismiss(share) {
    try {
      await dismissals.addItem({ share_id: share.id })
    } catch {
      // Already dismissed (e.g. on another device) — refetch to catch up.
      dismissals.refetch({ silent: true })
    }
  }

  return { inbox, latest, dismissed, isAdded, dismiss, error: error || dismissals.error }
}

// Topbar bell for players: what the DM has shared, with an unread count.
export function DmSharesBell({ campaignId, playerId }) {
  const [open, setOpen] = useState(false)
  const inbox = useDmInbox(campaignId, playerId)
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
        <span aria-hidden="true">🔔</span>
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
  const path = share.kind === 'npc' ? share.payload.photo_path : share.payload.image_path
  return getPublicUrl(SHARE_KINDS[share.kind].bucket, path)
}

function shareDetail(share) {
  const p = share.payload
  if (share.kind === 'npc') return [p.race, p.location].filter(Boolean).join(' · ')
  if (share.kind === 'art') return p.category || ''
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
    <Modal onClose={onClose} label="Shared by your DM">
      <div className="dm-inbox">
        <h3 className="section-card__title">
          <span aria-hidden="true">🔔</span> From your DM
        </h3>
        {items.length === 0 ? (
          <p className="empty-state">Nothing new. When your DM shares an NPC, art or a map, it’ll show up here.</p>
        ) : (
          <ul className="dm-inbox__list">
            {items.map((share) => {
              const kind = SHARE_KINDS[share.kind]
              const added = inbox.isAdded(share)
              const result = results[share.id]
              const image = shareImage(share)
              const detail = shareDetail(share)
              return (
                <li key={share.id} className={`dm-share dm-share--${share.kind}`}>
                  <div className="dm-share__thumb" aria-hidden="true">
                    {image ? <img src={image} alt="" /> : <span>{kind.icon}</span>}
                  </div>
                  <div className="dm-share__body">
                    <span className="dm-share__kind">
                      {kind.icon} New {kind.label === 'Art' ? 'art' : kind.label}
                      <span className="dm-share__time"> · {formatDateTime(share.createdAt)}</span>
                    </span>
                    <span className="dm-share__title">{share.title || 'Untitled'}</span>
                    {detail && <span className="dm-share__detail">{detail}</span>}
                    {share.kind === 'npc' && share.payload.description && (
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
        <div className="form-actions">
          <button type="button" className="btn btn--text" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
