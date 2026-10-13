import { useMemo } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'
import { shareKey } from '../lib/dmShares.js'

const shareFromRow = (r) => ({
  id: r.id,
  kind: r.kind,
  sourceId: r.source_id,
  title: r.title,
  payload: r.payload || {},
  createdAt: r.created_at,
})

// Everything the DM has shared in this campaign, newest first, plus a
// lookup of the latest share per item ("npc:<id>" → share).
export function useDmShares(campaignId) {
  const { items, loading, error, refetch } = useSupabaseTable('dm_shares', {
    fromRow: shareFromRow,
    ascending: false,
    filters: { campaign_id: campaignId },
  })
  const byKey = useMemo(() => {
    const map = new Map()
    for (const share of items) {
      const key = shareKey(share.kind, share.sourceId)
      if (!map.has(key)) map.set(key, share)
    }
    return map
  }, [items])
  return { shares: items, byKey, loading, error, refetch }
}
