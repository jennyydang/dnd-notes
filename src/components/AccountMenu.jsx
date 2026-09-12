import { useEffect, useRef, useState } from 'react'
import './AccountMenu.scss'

// Shared avatar-button + dropdown used everywhere a logged-in player is
// shown "who they are" (the Player Dashboard toolbar and every campaign's
// top bar) — Settings and Send Feedback live here, with Log Out last.
function AccountMenu({ username, onOpenSettings, onSendFeedback, onLogOut }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Closes the menu on any click outside it, same as every other dropdown
  // dismissal pattern in this app.
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocClick)
    return () => document.removeEventListener('pointerdown', onDocClick)
  }, [open])

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu__avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {username?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div className="account-menu__dropdown panel">
          {username && <div className="account-menu__name">{username}</div>}
          <button
            type="button"
            className="btn btn--text"
            onClick={() => {
              setOpen(false)
              onOpenSettings?.()
            }}
          >
            Settings
          </button>
          <button
            type="button"
            className="btn btn--text"
            onClick={() => {
              setOpen(false)
              onSendFeedback?.()
            }}
          >
            Send Feedback
          </button>
          <button
            type="button"
            className="btn btn--text"
            onClick={() => {
              setOpen(false)
              onLogOut?.()
            }}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
