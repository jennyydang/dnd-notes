import { useSyncExternalStore } from 'react'

// A tiny router on the browser's History API: the address bar holds where
// you are, back/forward move through it, and components re-render when it
// changes. (No library: the app only needs paths.)

const CHANGE = 'app-location-change'

function subscribe(onChange) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGE, onChange)
  }
}

const getPath = () => window.location.pathname

export function usePath() {
  return useSyncExternalStore(subscribe, getPath, () => '/')
}

// Go to `path` (a new history entry, or `replace` the current one).
// `state` rides along on the entry (read with history.state).
export function navigate(path, { replace = false, state = null } = {}) {
  if (path === window.location.pathname && !replace) return
  window.history[replace ? 'replaceState' : 'pushState'](state, '', path)
  window.dispatchEvent(new Event(CHANGE))
}
