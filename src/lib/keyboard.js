// Keeps what you're typing in view when the on-screen keyboard opens.
//
// Android Chrome shrinks the page for the keyboard (index.html asks for
// interactive-widget=resizes-content), but iPhones slide the keyboard
// over the page instead. So we watch the visible area (visualViewport)
// and publish how much the keyboard covers as --keyboard-inset, add
// html.keyboard-open while it's up (the bottom bar and floating buttons
// step aside), and scroll the focused field into the visible part.
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable="true"]'
const OPEN_THRESHOLD = 120 // px — less than this is a toolbar, not a keyboard

// The nearest ancestor that actually scrolls (a dialog's panel, say),
// or the page.
function scrollerOf(element) {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node
  }
  return window
}

const GAP = 16

// How far to scroll so `rect` sits inside the visible area (above the
// keyboard): positive scrolls down. A field taller than the visible area
// keeps its top in view.
function distanceToVisible(rect, vv) {
  const top = vv.offsetTop + GAP
  const bottom = vv.offsetTop + vv.height - GAP
  if (rect.height > bottom - top) return rect.top - top
  if (rect.bottom > bottom) return rect.bottom - bottom
  if (rect.top < top) return rect.top - top
  return 0
}

export function installKeyboardAvoidance() {
  if (typeof window === 'undefined' || !window.visualViewport) return () => {}
  const vv = window.visualViewport
  const root = document.documentElement
  let frame = 0

  function update() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--keyboard-inset', `${Math.round(covered)}px`)
      root.classList.toggle('keyboard-open', covered > OPEN_THRESHOLD)
    })
  }

  // Once the keyboard has finished sliding in, bring the field into view
  // if it's hidden behind it.
  function onFocus(event) {
    const field = event.target instanceof Element ? event.target.closest(EDITABLE) : null
    if (!field) return
    setTimeout(() => {
      if (document.activeElement !== field && !field.contains(document.activeElement)) return
      // The field's own scroll box (e.g. a dialog) first, then the page
      // if that wasn't enough.
      let scroller = scrollerOf(field)
      for (let step = 0; step < 3 && scroller; step++) {
        const delta = distanceToVisible(field.getBoundingClientRect(), vv)
        if (Math.abs(delta) <= 1) break
        scroller.scrollBy({ top: delta, behavior: 'instant' })
        scroller = scroller === window ? null : scrollerOf(scroller)
      }
    }, 320)
  }

  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  document.addEventListener('focusin', onFocus)
  update()
  return () => {
    cancelAnimationFrame(frame)
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
    document.removeEventListener('focusin', onFocus)
    root.classList.remove('keyboard-open')
    root.style.removeProperty('--keyboard-inset')
  }
}
