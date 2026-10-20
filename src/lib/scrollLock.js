// Freezes the page behind a dialog. `overflow: hidden` on <body> alone
// doesn't stop Safari (iPad and Mac) from scrolling the page under an open
// dialog, so the body is also pinned in place with position: fixed at its
// current scroll offset, and put back exactly there on unlock. Counted, so
// a dialog opened over another (an image cropper over a form) only
// unlocks when the last one closes.
let locks = 0
let saved = null

export function lockScroll() {
  locks += 1
  if (locks > 1) return unlockOnce()
  const { body } = document
  const y = window.scrollY
  saved = {
    y,
    style: {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    },
  }
  Object.assign(body.style, {
    overflow: 'hidden',
    position: 'fixed',
    top: `-${y}px`,
    left: '0',
    right: '0',
    width: '100%',
  })
  return unlockOnce()
}

// Each lock hands back its own one-shot release.
function unlockOnce() {
  let done = false
  return () => {
    if (done) return
    done = true
    locks -= 1
    if (locks > 0 || !saved) return
    const { y, style } = saved
    saved = null
    Object.assign(document.body.style, style)
    window.scrollTo({ top: y, left: 0, behavior: 'instant' })
  }
}
