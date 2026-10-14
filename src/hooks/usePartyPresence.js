import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

// Who else has this campaign open right now, via Supabase Realtime
// presence (nothing is stored). Each device announces its player; the
// list is everyone else, one entry per player even with several tabs open.
// The admin (no playerId) watches without appearing.
export function usePartyPresence(campaignId, playerId, username) {
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!isSupabaseConfigured || !campaignId) return undefined
    const key = playerId || `viewer-${crypto.randomUUID()}`
    const channel = supabase.channel(`presence-campaign-${campaignId}`, {
      config: { presence: { key } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const seen = new Map()
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (entry.playerId && entry.playerId !== playerId && !seen.has(entry.playerId)) {
              seen.set(entry.playerId, { playerId: entry.playerId, username: entry.username || 'Someone' })
            }
          }
        }
        setOthers([...seen.values()].sort((a, b) => a.username.localeCompare(b.username)))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && playerId) channel.track({ playerId, username })
      })
    return () => {
      supabase.removeChannel(channel)
      setOthers([])
    }
  }, [campaignId, playerId, username])

  return others
}
