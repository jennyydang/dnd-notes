// Every button answers a press: a soft gold ripple spreads from where it
// was touched, and on phones that can (Android) the main actions give a
// tiny buzz. One document listener covers the whole app.
const SELECTOR = '.btn, .icon-btn, .tab-nav__item, .bottom-nav__item'
const HAPTIC_SELECTOR = '.btn--primary, .btn--danger'
const RIPPLE_MS = 600
// Touch-only tablets: a card lifts while a finger presses it (the hover
// lift everywhere else; see _motion.scss). Phones swipe cards instead.
const CARDS =
  '.npc-card, .loot-card, .quest-card, .lore-card, .party-card, .place-card, .goal-card, ' +
  '.custom-entry-card, .campaign-card, .session-card, .spell-card, .map-card, .creature-card'
const TABLET_TOUCH = '(any-hover: none) and (min-width: 721px)'

export function installTapFeedback() {
  if (typeof window === 'undefined') return () => {}
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const tablet = window.matchMedia?.(TABLET_TOUCH)
  let pressed = null

  function release() {
    pressed?.classList.remove('is-pressed')
    pressed = null
  }

  function onDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    if (event.pointerType === 'touch' && tablet?.matches && event.target instanceof Element) {
      release()
      pressed = event.target.closest(CARDS)
      pressed?.classList.add('is-pressed')
    }
    const target = event.target instanceof Element ? event.target.closest(SELECTOR) : null
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return

    if (event.pointerType === 'touch' && target.matches(HAPTIC_SELECTOR)) navigator.vibrate?.(8)
    if (reduced?.matches) return

    const rect = target.getBoundingClientRect()
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
    const size = Math.max(rect.width, rect.height) * 2.2
    // The clip keeps the ripple inside the button's rounded shape without
    // putting overflow: hidden on the button itself.
    const clip = document.createElement('span')
    clip.className = 'tap-ripple'
    const dot = document.createElement('span')
    dot.className = 'tap-ripple__dot'
    dot.style.width = dot.style.height = `${size}px`
    dot.style.left = `${event.clientX - rect.left - size / 2}px`
    dot.style.top = `${event.clientY - rect.top - size / 2}px`
    clip.appendChild(dot)
    target.appendChild(clip)
    setTimeout(() => clip.remove(), RIPPLE_MS)
  }

  // The press ends when the finger lifts — or turns into a scroll.
  document.addEventListener('pointerdown', onDown, { passive: true })
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, release, { passive: true })
  window.addEventListener('scroll', release, { passive: true, capture: true })
  return () => {
    release()
    document.removeEventListener('pointerdown', onDown)
    for (const type of ['pointerup', 'pointercancel']) document.removeEventListener(type, release)
    window.removeEventListener('scroll', release, { capture: true })
  }
}
