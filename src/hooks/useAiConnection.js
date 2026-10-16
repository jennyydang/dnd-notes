import { useSyncExternalStore } from 'react'
import { AI_CONNECTION_EVENT, getAiConnection } from '../lib/aiConnection.js'

function subscribe(callback) {
  window.addEventListener(AI_CONNECTION_EVENT, callback)
  window.addEventListener('storage', callback) // another tab of the app
  return () => {
    window.removeEventListener(AI_CONNECTION_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

// The player's connected AI account on this device, or null. (A string
// snapshot keeps useSyncExternalStore stable between reads.)
export function useAiConnection() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(getAiConnection()))
  return JSON.parse(raw)
}
