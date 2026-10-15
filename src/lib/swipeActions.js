// Swipe a card left (on a touch screen) to reveal its Edit and Delete
// buttons, like a phone's mail app. The tray's buttons just press the
// card's own Edit / Delete, so every card keeps its usual behaviour
// (confirmations included). Cards without both buttons don't swipe.
const CARDS = '.npc-card, .loot-card, .creature-card, .place-card, .quest-card, .lore-card, .custom-entry-card'
const TRAY_WIDTH = 152
const START_PX = 12 // how far a finger moves before we decide it's a swipe
const OPEN_PX = 60

// The card's own Edit / Delete buttons: by their text, or by an aria-label
// like "Edit Ireena" on the compact icon buttons.
function findAction(card, word) {
  const re = new RegExp(`^${word}\\b`, 'i')
  return [...card.querySelectorAll('button')].find(
    (b) => !b.disabled && (re.test(b.textContent.trim()) || re.test(b.getAttribute('aria-label') || '')),
  )
}

export function installSwipeActions() {
  if (typeof window === 'undefined') return () => {}
  let gesture = null // { card, x, y, dx, swiping }
  let open = null // { card, tray }

  function close() {
    if (!open) return
    const { card, tray } = open
    open = null
    card.style.transform = ''
    card.classList.remove('is-swiped')
    tray.classList.add('swipe-tray--closing')
    setTimeout(() => tray.remove(), 200)
  }

  // `shift` is how far the card is already slid left, so the tray lines up
  // with the card's real right edge.
  function openTray(card, shift = 0) {
    const edit = findAction(card, 'edit')
    const del = findAction(card, 'delete')
    const box = card.getBoundingClientRect()
    const rect = { top: box.top, height: box.height, right: box.right - shift }
    const tray = document.createElement('div')
    tray.className = 'swipe-tray'
    tray.style.top = `${rect.top}px`
    tray.style.height = `${rect.height}px`
    tray.style.left = `${rect.right - TRAY_WIDTH}px`
    tray.style.width = `${TRAY_WIDTH}px`
    for (const [label, target, kind] of [
      ['Edit', edit, 'edit'],
      ['Delete', del, 'delete'],
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
    card.style.transform = `translateX(-${TRAY_WIDTH}px)`
    card.classList.add('is-swiped')
    open = { card, tray }
  }

  function onStart(event) {
    if (open && !open.tray.contains(event.target)) {
      // Any touch outside the tray just closes it.
      if (!open.card.contains(event.target)) close()
    }
    const card = event.target instanceof Element ? event.target.closest(CARDS) : null
    if (!card || event.touches.length !== 1) return
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
    if (!findAction(card, 'edit') || !findAction(card, 'delete')) return
    const t = event.touches[0]
    gesture = { card, x: t.clientX, y: t.clientY, dx: 0, swiping: false, wasOpen: open?.card === card }
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
      gesture.card.classList.add('is-swiping')
    }
    const base = gesture.wasOpen ? -TRAY_WIDTH : 0
    gesture.dx = Math.min(0, Math.max(-TRAY_WIDTH * 1.25, base + dx))
    gesture.card.style.transform = `translateX(${gesture.dx}px)`
  }

  function onEnd() {
    if (!gesture) return
    const { card, swiping, dx, wasOpen } = gesture
    gesture = null
    if (!swiping) return
    card.classList.remove('is-swiping')
    if (wasOpen) {
      if (dx > -TRAY_WIDTH + OPEN_PX) close()
      else card.style.transform = `translateX(-${TRAY_WIDTH}px)`
      return
    }
    if (dx < -OPEN_PX) {
      close()
      openTray(card, dx)
    } else {
      card.style.transform = ''
    }
  }

  const onScroll = () => close()
  document.addEventListener('touchstart', onStart, { passive: true })
  document.addEventListener('touchmove', onMove, { passive: true })
  document.addEventListener('touchend', onEnd, { passive: true })
  document.addEventListener('touchcancel', onEnd, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll)
  return () => {
    close()
    document.removeEventListener('touchstart', onStart)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    document.removeEventListener('touchcancel', onEnd)
    window.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onScroll)
  }
}
