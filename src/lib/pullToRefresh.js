import { RESYNC_EVENT } from './offline.js'

// Pull down from the top of the page (touch screens) to refresh every
// list from the server — handy after someone else changed something and
// the live updates missed it. A gold ring follows your finger and spins
// while it refreshes. Not inside dialogs or full-screen viewers.
const TRIGGER_PX = 72
const MAX_PULL_PX = 110
const SPIN_MS = 900

export function installPullToRefresh() {
  if (typeof window === 'undefined') return () => {}
  const indicator = document.createElement('div')
  indicator.className = 'pull-refresh'
  indicator.setAttribute('aria-hidden', 'true')
  indicator.innerHTML = '<span class="pull-refresh__ring"></span>'
  document.body.appendChild(indicator)
  const status = document.createElement('p')
  status.className = 'sr-only'
  status.setAttribute('role', 'status')
  document.body.appendChild(status)

  let start = null // { y }
  let pulled = 0
  let busy = false

  function show(distance) {
    const progress = Math.min(1, distance / TRIGGER_PX)
    indicator.style.setProperty('--pull', `${Math.min(distance, MAX_PULL_PX)}px`)
    indicator.style.setProperty('--progress', progress.toFixed(2))
    indicator.classList.toggle('pull-refresh--ready', distance >= TRIGGER_PX)
    indicator.classList.add('pull-refresh--visible')
  }

  function hide() {
    indicator.classList.remove('pull-refresh--visible', 'pull-refresh--ready', 'pull-refresh--spinning')
    indicator.style.setProperty('--pull', '0px')
  }

  function onStart(event) {
    if (busy || event.touches.length !== 1 || window.scrollY > 0) return
    // Something covering the page (a dialog, viewer, search) keeps its own
    // scrolling; the page is locked then anyway.
    if (document.body.style.overflow === 'hidden') return
    if (event.target instanceof Element && event.target.closest('[role="dialog"], input, textarea, select, [contenteditable="true"]')) return
    start = { y: event.touches[0].clientY }
    pulled = 0
  }

  function onMove(event) {
    if (!start) return
    const dy = event.touches[0].clientY - start.y
    if (dy <= 0 || window.scrollY > 0) {
      if (pulled) hide()
      pulled = 0
      return
    }
    // Resistance: the ring moves slower than the finger.
    pulled = dy * 0.55
    show(pulled)
  }

  function onEnd() {
    if (!start) return
    start = null
    if (pulled < TRIGGER_PX) {
      hide()
      return
    }
    busy = true
    indicator.classList.add('pull-refresh--spinning')
    indicator.style.setProperty('--pull', `${TRIGGER_PX}px`)
    status.textContent = 'Refreshing…'
    window.dispatchEvent(new CustomEvent(RESYNC_EVENT, { detail: {} }))
    setTimeout(() => {
      busy = false
      hide()
      status.textContent = 'Up to date'
    }, SPIN_MS)
  }

  document.addEventListener('touchstart', onStart, { passive: true })
  document.addEventListener('touchmove', onMove, { passive: true })
  document.addEventListener('touchend', onEnd, { passive: true })
  document.addEventListener('touchcancel', onEnd, { passive: true })
  return () => {
    document.removeEventListener('touchstart', onStart)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    document.removeEventListener('touchcancel', onEnd)
    indicator.remove()
    status.remove()
  }
}
