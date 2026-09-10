import { useEffect } from 'react'
import './Modal.scss'

// Generic popup dialog: dark backdrop, centered panel, dismissible via
// Escape or by clicking outside the panel. Content (typically a form) is
// passed as children — this component only owns the overlay/positioning,
// same visual pattern as the existing spell flavor-text popup.
function Modal({ onClose, label, children }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
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
      <div className="modal__panel panel" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export default Modal
