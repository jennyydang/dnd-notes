import { useState } from 'react'
import { getStored, setStored } from '../lib/sessionMode.js'

// "cards" or "compact" for a list, remembered per device under `key`.
export function useViewMode(key) {
  const storageKey = `dnd-notes-view:${key}`
  const [mode, setMode] = useState(() => (getStored(storageKey, 'cards') === 'compact' ? 'compact' : 'cards'))
  const change = (next) => {
    setMode(next)
    setStored(storageKey, next)
  }
  return [mode, change]
}
