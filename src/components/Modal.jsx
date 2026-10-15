import { useEffect, useRef } from 'react'
import './Modal.scss'

// Open modals, innermost last — so Escape closes only the top one when a
// dialog opens another (e.g. the image cropper over an edit form).
const openModals = []

// Generic popup dialog: dark backdrop, centered panel, dismissible via
// Escape or by clicking outside the panel. Content (typically a form) is
// passed as children — this component only owns the overlay/positioning,
// same visual pattern as the existing spell flavor-text popup.
// `size="narrow"` suits short dialogs (a notice, a confirm) that would
// otherwise sit in a mostly empty panel.
//
// On phones it becomes a bottom sheet (Modal.scss): it slides up from the
// bottom, and dragging its handle down past a point closes it.
const DISMISS_PX = 90
const DISMISS_SPEED = 0.6 // px per ms — a quick flick closes it too

function Modal({ onClose, label, size, children }) {
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = {}
  const panelRef = useRef(null)
  const dragRef = useRef(null)

  function onHandleDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { y: event.clientY, t: performance.now(), dy: 0 }
    panelRef.current?.classList.add('modal__panel--dragging')
  }

  function onHandleMove(event) {
    const drag = dragRef.current
    if (!drag) return
    drag.dy = Math.max(0, event.clientY - drag.y)
    if (panelRef.current) panelRef.current.style.transform = `translateY(${drag.dy}px)`
  }

  function onHandleUp() {
    const drag = dragRef.current
    dragRef.current = null
    const panel = panelRef.current
    if (!drag || !panel) return
    panel.classList.remove('modal__panel--dragging')
    const speed = drag.dy / Math.max(1, performance.now() - drag.t)
    if (drag.dy > DISMISS_PX || (drag.dy > 24 && speed > DISMISS_SPEED)) {
      panel.style.transform = 'translateY(110%)'
      setTimeout(onClose, 160)
    } else {
      panel.style.transform = ''
    }
  }

  useEffect(() => {
    const id = idRef.current
    openModals.push(id)
    return () => openModals.splice(openModals.indexOf(id), 1)
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === idRef.current) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Lock the page underneath from scrolling while the modal is open —
  // restore whatever overflow value was already there (rather than
  // assuming it was blank) so this can't clobber a style set elsewhere.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div
      className="modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`modal__panel panel${size ? ` modal__panel--${size}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shown on phones only: drag down to close. */}
        <div
          className="modal__handle"
          aria-hidden="true"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span />
        </div>
        {children}
      </div>
    </div>
  )
}

export default Modal
