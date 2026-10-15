// Swipe a card left (on a touch screen) to reveal its Edit and Delete
// buttons, like a phone's mail app; swipe it back (on the card or the
// tray) or touch elsewhere to close. The tray's buttons press the card's
// own Edit / Delete, so every card keeps its usual behaviour
// (confirmations included). On touch screens those buttons are hidden on
// the card itself (they're tagged .swipe-hidden here; see _mobile.scss)
// — the swipe is the way in. Cards without both buttons don't swipe.
const CARDS = '.npc-card, .loot-card, .creature-card, .place-card, .quest-card, .lore-card, .custom-entry-card'
const WIDTH = 152 // tray width
const GAP = 6 // space between the slid card and the tray — same as between the buttons
const SLIDE = WIDTH + GAP // how far an open card slides
const START_PX = 12 // how far a finger moves before we decide it's a swipe
const SNAP_PX = 60 // how far past the halfway-ish point a swipe must go

// The card's own Edit / Delete buttons: by their text, or by an aria-label
// like "Edit Ireena" on the compact icon buttons.
function findAction(card, word) {
  const re = new RegExp(`^${word}\\b`, 'i')
  return [...card.querySelectorAll('button')].find(
    (b) => !b.disabled && (re.test(b.textContent.trim()) || re.test(b.getAttribute('aria-label') || '')),
  )
}

function actionsOf(card) {
  const edit = findAction(card, 'edit')
  const del = findAction(card, 'delete')
  return edit && del ? { edit, del } : null
}

// Marks every swipeable card's Edit / Delete buttons so CSS can hide them
// on touch screens (cards come and go, so this re-runs on DOM changes).
function tagButtons(root = document) {
  for (const card of root.querySelectorAll(CARDS)) {
    const actions = actionsOf(card)
    if (!actions) continue
    actions.edit.classList.add('swipe-hidden')
    actions.del.classList.add('swipe-hidden')
    card.classList.add('swipeable')
  }
}

export function installSwipeActions() {
  if (typeof window === 'undefined') return () => {}
  let open = null // { card, tray, base } — the card that's slid open
  let gesture = null // { card, tray, x, y, start, offset, swiping }

  function makeTray(card) {
    const actions = actionsOf(card)
    const rect = card.getBoundingClientRect()
    const shift = new DOMMatrixReadOnly(getComputedStyle(card).transform).m41 || 0
    const tray = document.createElement('div')
    tray.className = 'swipe-tray'
    tray.style.top = `${rect.top}px`
    tray.style.height = `${rect.height}px`
    tray.style.left = `${rect.right - shift - WIDTH}px`
    tray.style.width = `${WIDTH}px`
    for (const [label, target, kind] of [
      ['Edit', actions.edit, 'edit'],
      ['Delete', actions.del, 'delete'],
    ]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `swipe-tray__btn swipe-tray__btn--${kind}`
      button.textContent = label
      button.addEventListener('click', () => {
        close()
        target.click()
      })
      tray.appendChild(button)
    }
    document.body.appendChild(tray)
    return tray
  }

  // Slides the card to `offset` (0 = closed, -SLIDE = open); the tray
  // rides along just past the card's right edge, fading in as it's
  // uncovered.
  function place(card, tray, offset, animate) {
    for (const el of [card, tray]) el.classList.toggle('swipe-moving', !animate)
    card.style.transform = offset ? `translateX(${offset}px)` : ''
    tray.style.transform = `translateX(${offset + SLIDE}px)`
    tray.style.opacity = String(Math.min(1, -offset / (SLIDE * 0.6)))
  }

  function close() {
    if (!open) return
    const { card, tray } = open
    open = null
    place(card, tray, 0, true)
    card.classList.remove('is-swiped')
    setTimeout(() => tray.remove(), 240)
  }

  function onStart(event) {
    if (event.touches.length !== 1) return
    const target = event.target instanceof Element ? event.target : null
    const inTray = open && target && open.tray.contains(target)
    const card = inTray ? open.card : target?.closest(CARDS)
    if (open && card !== open.card) close()
    if (!card || (!inTray && target.closest('input, textarea, select, [contenteditable="true"]'))) return
    if (!actionsOf(card)) return
    const t = event.touches[0]
    const start = open?.card === card ? -SLIDE : 0
    gesture = { card, tray: open?.card === card ? open.tray : null, x: t.clientX, y: t.clientY, start, offset: start, swiping: false }
  }

  function onMove(event) {
    if (!gesture) return
    const t = event.touches[0]
    const dx = t.clientX - gesture.x
    const dy = t.clientY - gesture.y
    if (!gesture.swiping) {
      if (Math.abs(dy) > START_PX && Math.abs(dy) > Math.abs(dx)) {
        gesture = null // a scroll, not a swipe
        return
      }
      if (Math.abs(dx) < START_PX) return
      gesture.swiping = true
      if (!gesture.tray) gesture.tray = makeTray(gesture.card)
    }
    gesture.offset = Math.min(0, Math.max(-SLIDE * 1.2, gesture.start + dx))
    place(gesture.card, gesture.tray, gesture.offset, false)
  }

  function onEnd() {
    if (!gesture) return
    const { card, tray, swiping, start, offset } = gesture
    gesture = null
    if (!swiping) return
    // From closed, a pull past SNAP_PX opens it; from open, a push back
    // past SNAP_PX closes it.
    const shouldOpen = start === 0 ? offset < -SNAP_PX : offset < -SLIDE + SNAP_PX
    if (shouldOpen) {
      place(card, tray, -SLIDE, true)
      card.classList.add('is-swiped')
      open = { card, tray }
    } else {
      open = { card, tray }
      close()
    }
  }

  let frame = 0
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => tagButtons())
  })
  observer.observe(document.body, { childList: true, subtree: true })
  tagButtons()

  const onScroll = () => close()
  document.addEventListener('touchstart', onStart, { passive: true })
  document.addEventListener('touchmove', onMove, { passive: true })
  document.addEventListener('touchend', onEnd, { passive: true })
  document.addEventListener('touchcancel', onEnd, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll)
  return () => {
    close()
    observer.disconnect()
    cancelAnimationFrame(frame)
    document.removeEventListener('touchstart', onStart)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    document.removeEventListener('touchcancel', onEnd)
    window.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onScroll)
  }
}
