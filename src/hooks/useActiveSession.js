import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { ACTIVE_SESSION_EVENT, getActiveSessionRaw, setActiveSession } from '../lib/sessionMode.js'

function subscribe(callback) {
  window.addEventListener(ACTIVE_SESSION_EVENT, callback)
  window.addEventListener('storage', callback) // another tab of the app
  return () => {
    window.removeEventListener(ACTIVE_SESSION_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

// The live session for this campaign and player ({ startedAt, paused } or
// null) and a setter. Shared by every screen, so starting, pausing or
// ending it anywhere updates Home, Session Mode and the session dock.
export function useActiveSession(campaignId, playerId) {
  const raw = useSyncExternalStore(subscribe, () => getActiveSessionRaw(campaignId, playerId))
  const active = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [raw])
  const save = useCallback((next) => setActiveSession(campaignId, playerId, next), [campaignId, playerId])
  return [active, save]
}
