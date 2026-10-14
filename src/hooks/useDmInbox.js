import { useEffect, useMemo } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'
import { useDmShares } from './useDmShares.js'
import { shareKey } from '../lib/dmShares.js'

// Other screens (e.g. Home's "From your DM" banner) open the bell's inbox
// with window.dispatchEvent(new Event(OPEN_DM_INBOX)).
export const OPEN_DM_INBOX = 'open-dm-inbox'

// No realtime subscription in this app, so check for new shares now and
// then, and whenever the player comes back to the tab.
const POLL_MS = 45000

const dismissalFromRow = (r) => ({ id: r.id, shareId: r.share_id })
const npcLinkFromRow = (r) => ({ id: r.id, dmNpcId: r.dm_npc_id })
const mapLinkFromRow = (r) => ({ id: r.id, dmMapId: r.dm_map_id })
const creatureLinkFromRow = (r) => ({ id: r.id, dmCreatureId: r.dm_creature_id })
const artFromRow = (r) => ({ id: r.id, shared: r.shared })
const membershipFromRow = (r) => ({ id: r.id, joinedAt: r.created_at })

export function useDmInbox(campaignId, playerId) {
  const { shares, byKey, error, refetch } = useDmShares(campaignId)
  const dismissals = useSupabaseTable('dm_share_dismissals', {
    fromRow: dismissalFromRow,
    filters: { player_id: playerId },
  })
  const campaignFilter = { campaign_id: campaignId }
  // When this player joined, so shares from before then (meant for the
  // table at the time) don't land in a new player's inbox.
  const membership = useSupabaseTable('campaign_members', {
    fromRow: membershipFromRow,
    filters: { campaign_id: campaignId, player_id: playerId },
  })
  const joinedAt = membership.items[0]?.joinedAt ? new Date(membership.items[0].joinedAt).getTime() : null
  const npcs = useSupabaseTable('npcs', { fromRow: npcLinkFromRow, filters: campaignFilter })
  const maps = useSupabaseTable('maps', { fromRow: mapLinkFromRow, filters: campaignFilter })
  const art = useSupabaseTable('campaign_art', { fromRow: artFromRow, filters: campaignFilter })
  const creatures = useSupabaseTable('creatures', { fromRow: creatureLinkFromRow, filters: campaignFilter })

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        refetch({ silent: true })
        npcs.refetch({ silent: true })
        maps.refetch({ silent: true })
        art.refetch({ silent: true })
        creatures.refetch({ silent: true })
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
      creature: new Set(creatures.items.map((c) => c.dmCreatureId).filter(Boolean)),
    }),
    [npcs.items, maps.items, art.items, creatures.items],
  )

  // Only the latest share of each item, sent since this player joined;
  // `inbox` drops the ones they've dealt with (added or dismissed). While
  // the join date is loading, nothing shows rather than old shares.
  const latest = shares.filter(
    (s) =>
      byKey.get(shareKey(s.kind, s.sourceId)) === s &&
      !membership.loading &&
      (joinedAt === null || new Date(s.createdAt).getTime() >= joinedAt),
  )
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
