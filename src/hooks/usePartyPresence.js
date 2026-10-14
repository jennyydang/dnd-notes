import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

const RETRY_MS = 3000

// Presence channels are named per campaign, and supabase.channel() hands
// back an existing channel with the same name — including one that is
// still closing after the last mount. Joining that one fails, which used
// to leave the faces blank until a reload. So each join first waits for
// the previous channel of that name to finish closing.
const closing = new Map()

function leave(topic, channel) {
  const done = supabase
    .removeChannel(channel)
    .catch(() => {})
    .finally(() => {
      if (closing.get(topic) === done) closing.delete(topic)
    })
  closing.set(topic, done)
  return done
}

function othersFrom(state, playerId) {
  const seen = new Map()
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (entry.playerId && entry.playerId !== playerId && !seen.has(entry.playerId)) {
        seen.set(entry.playerId, { playerId: entry.playerId, username: entry.username || 'Someone' })
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.username.localeCompare(b.username))
}

// Who else has this campaign open right now, via Supabase Realtime
// presence (nothing is stored). Each device announces its player; the
// list is everyone else, one entry per player even with several tabs open,
// and it updates live as people come and go. The admin (no playerId)
// watches without appearing.
export function usePartyPresence(campaignId, playerId, username) {
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!isSupabaseConfigured || !campaignId) return undefined
    const topic = `presence-campaign-${campaignId}`
    const key = playerId || `viewer-${crypto.randomUUID()}`
    let cancelled = false
    let channel = null
    let joined = false
    let retryTimer = null

    const announce = () => {
      if (joined && playerId) channel.track({ playerId, username }).catch(() => {})
    }

    async function join() {
      await closing.get(topic)
      if (cancelled) return
      joined = false
      const current = supabase.channel(topic, { config: { presence: { key } } })
      channel = current
      current
        .on('presence', { event: 'sync' }, () => {
          if (channel === current) setOthers(othersFrom(current.presenceState(), playerId))
        })
        .subscribe((status) => {
          if (cancelled || channel !== current) return
          if (status === 'SUBSCRIBED') {
            joined = true
            announce()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // Dropped (network blip, server restart): start over shortly.
            joined = false
            clearTimeout(retryTimer)
            retryTimer = setTimeout(() => {
              if (cancelled || channel !== current) return
              // Detach first so the CLOSED this leave causes is ignored.
              channel = null
              leave(topic, current).then(join)
            }, RETRY_MS)
          }
        })
    }

    // Background tabs can miss heartbeats; say hello again on return.
    function onVisible() {
      if (document.visibilityState === 'visible') announce()
    }
    document.addEventListener('visibilitychange', onVisible)
    join()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) leave(topic, channel)
      setOthers([])
    }
  }, [campaignId, playerId, username])

  return others
}
