// "Show on map": a card asks the Maps tab to open the map a pin is on and
// fly to that pin. The request waits here until the Maps tab (which may
// not be mounted yet) picks it up.
let pending = null
const listeners = new Set()

export function requestMapFocus(focus) {
  pending = { ...focus, at: Date.now() }
  for (const listener of listeners) listener(pending)
}

export function takeMapFocus() {
  const focus = pending
  pending = null
  return focus
}

export function onMapFocus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
