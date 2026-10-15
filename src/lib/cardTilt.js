// Cards that lean toward the mouse or pen
// with a gold glint where it touches — like a holo trading card. One set
// of document listeners covers every card, so components don't need to
// know about it. Off when the device asks for reduced motion.
const SELECTOR = '.npc-card, .loot-card, .creature-card'
const MAX_DEG = 7
const COMPACT_MAX_DEG = 2

export function installCardTilt() {
  if (typeof window === 'undefined') return () => {}
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  let active = null
  let frame = 0

  function reset(card) {
    card.classList.remove('is-tilting')
    card.style.removeProperty('--tilt-x')
    card.style.removeProperty('--tilt-y')
  }

  function release() {
    cancelAnimationFrame(frame)
    if (active) reset(active)
    active = null
  }

  function onMove(event) {
    // Fingers swipe cards (swipeActions.js); the tilt follows a mouse or pen.
    if (reduced?.matches || event.pointerType === 'touch') return
    const card = event.target instanceof Element ? event.target.closest(SELECTOR) : null
    if (card !== active) release()
    if (!card) return
    active = card
    const { clientX, clientY } = event
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
      const max = /--compact\b/.test(card.className) ? COMPACT_MAX_DEG : MAX_DEG
      card.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * max).toFixed(2)}deg`)
      card.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * max).toFixed(2)}deg`)
      card.style.setProperty('--glint-x', `${(px * 100).toFixed(1)}%`)
      card.style.setProperty('--glint-y', `${(py * 100).toFixed(1)}%`)
      card.classList.add('is-tilting')
    })
  }

  function onOut(event) {
    if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) release()
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })
  document.addEventListener('pointercancel', release, { passive: true })
  const onUp = (event) => event.pointerType === 'touch' && release()
  document.addEventListener('pointerup', onUp, { passive: true })
  return () => {
    release()
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerout', onOut)
    document.removeEventListener('pointercancel', release)
    document.removeEventListener('pointerup', onUp)
  }
}
