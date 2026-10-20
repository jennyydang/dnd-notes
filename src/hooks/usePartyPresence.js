import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { assignColors } from '../lib/presenceColors.js'

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

// One entry per player (several tabs open count once; the latest-joined
// tab says which page they're on).
function peopleFrom(state) {
  const seen = new Map()
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry.playerId) continue
      const prev = seen.get(entry.playerId)
      if (prev && (prev.onlineAt || '') > (entry.onlineAt || '')) continue
      seen.set(entry.playerId, {
        playerId: entry.playerId,
        username: entry.username || 'Someone',
        avatarUrl: entry.avatarUrl || '',
        tab: entry.tab || null,
        tabLabel: entry.tabLabel || '',
        onlineAt: entry.onlineAt || '',
      })
    }
  }
  return [...seen.values()]
}

// Who has this campaign open right now, via Supabase Realtime presence
// (nothing is stored). Each device announces its player and the page
// they're on (`tab` id + `tabLabel`, re-announced as they move around);
// the list is everyone, you included (`me`), one entry per player even
// with several tabs open, each with their own `color`. It updates live as
// people come and go. The admin (no playerId) watches without appearing.
// `avatarUrl` (the player's profile picture, if any) travels with them.
export function usePartyPresence(campaignId, playerId, username, avatarUrl = '', tab = null, tabLabel = '') {
  const [present, setPresent] = useState([])
  const where = useRef({ tab, tabLabel })
  where.current = { tab, tabLabel }
  const announceRef = useRef(() => {})
  const myOnlineAt = useRef('')

  useEffect(() => {
    if (!isSupabaseConfigured || !campaignId) return undefined
    const topic = `presence-campaign-${campaignId}`
    const key = playerId || `viewer-${crypto.randomUUID()}`
    let cancelled = false
    let channel = null
    let joined = false
    let retryTimer = null

    const onlineAt = new Date().toISOString()
    myOnlineAt.current = onlineAt
    const announce = () => {
      if (joined && playerId) {
        channel.track({ playerId, username, avatarUrl, onlineAt, ...where.current }).catch(() => {})
      }
    }
    announceRef.current = announce

    async function join() {
      await closing.get(topic)
      if (cancelled) return
      joined = false
      const current = supabase.channel(topic, { config: { presence: { key } } })
      channel = current
      current
        .on('presence', { event: 'sync' }, () => {
          if (channel === current) setPresent(peopleFrom(current.presenceState()))
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
      announceRef.current = () => {}
      if (channel) leave(topic, channel)
      setPresent([])
    }
  }, [campaignId, playerId, username, avatarUrl])

  // Moving to another page just updates what this device announces.
  useEffect(() => {
    announceRef.current()
  }, [tab, tabLabel])

  return useMemo(() => {
    const people = present.some((p) => p.playerId === playerId) || !playerId
      ? present
      : [...present, { playerId, username, avatarUrl, tab, tabLabel, onlineAt: myOnlineAt.current }]
    const colors = assignColors(people)
    return people
      // Your own page is known here before the server echoes it back.
      .map((p) =>
        p.playerId === playerId
          ? { ...p, tab, tabLabel, me: true, color: colors.get(p.playerId) }
          : { ...p, me: false, color: colors.get(p.playerId) },
      )
      .sort((a, b) => Number(b.me) - Number(a.me) || a.username.localeCompare(b.username))
  }, [present, playerId, username, avatarUrl, tab, tabLabel])
}
