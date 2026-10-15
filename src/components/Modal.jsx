import { useEffect, useRef } from 'react'
import './Modal.scss'
import { lockScroll } from '../lib/scrollLock.js'

// Open modals, innermost last — so Escape closes only the top one when a
// dialog opens another (e.g. the image cropper over an edit form).
const openModals = []

// Generic popup dialog: dark backdrop, centered panel, dismissible via
// Escape or by clicking outside the panel. Content (typically a form) is
// passed as children — this component only owns the overlay/positioning,
// same visual pattern as the existing spell flavor-text popup.
// `size="narrow"` suits short dialogs (a notice, a confirm) that would
// otherwise sit in a mostly empty panel.

function Modal({ onClose, label, size, children }) {
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = {}

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

  // The page underneath stays put while the modal is open (scrollLock.js).
  useEffect(() => lockScroll(), [])

  return (
    <div
      className="modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={`modal__panel panel${size ? ` modal__panel--${size}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
