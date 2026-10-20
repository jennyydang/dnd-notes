import { useEffect, useRef, useState } from 'react'
import ProfilePictureDialog from './ProfilePictureDialog.jsx'
import AccountDialog from './AccountDialog.jsx'
import AppGuide from './AppGuide.jsx'
import Icon from './Icon.jsx'
import { usePlayerAvatar } from '../lib/profiles.js'
import './AccountMenu.scss'

// Shared avatar-button + dropdown used everywhere a logged-in player is
// shown "who they are" (the Player Dashboard toolbar and every campaign's
// top bar) — Account, Profile picture, Settings, App guide and Send Feedback live here, with
// Log Out last. The button shows the player's picture once they've added
// one (players only; the admin has no account to attach it to).
function AccountMenu({ playerId, username, onOpenSettings, onSendFeedback, onLogOut }) {
  const [open, setOpen] = useState(false)
  const [editingPicture, setEditingPicture] = useState(false)
  const [editingAccount, setEditingAccount] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const avatar = usePlayerAvatar(playerId)
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
        className={`account-menu__avatar${avatar ? ' account-menu__avatar--photo' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {avatar ? <img src={avatar} alt="" /> : username?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div className="account-menu__dropdown panel">
          {username && <div className="account-menu__name">{username}</div>}
          {[
            playerId && { label: 'Account', icon: 'user', run: () => setEditingAccount(true) },
            playerId && { label: 'Profile picture', icon: 'image', run: () => setEditingPicture(true) },
            { label: 'Settings', icon: 'settings', run: () => onOpenSettings?.() },
            { label: 'App guide', icon: 'book', run: () => setGuideOpen(true) },
            { label: 'Send Feedback', icon: 'message', run: () => onSendFeedback?.() },
            { label: 'Log Out', icon: 'logout', run: () => onLogOut?.(), last: true },
          ]
            .filter(Boolean)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                className={`btn btn--text account-menu__item${item.last ? ' account-menu__item--last' : ''}`}
                onClick={() => {
                  setOpen(false)
                  item.run()
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
        </div>
      )}
      {guideOpen && <AppGuide onClose={() => setGuideOpen(false)} />}
      {editingAccount && <AccountDialog playerId={playerId} onClose={() => setEditingAccount(false)} />}
      {editingPicture && (
        <ProfilePictureDialog playerId={playerId} username={username} onClose={() => setEditingPicture(false)} />
      )}
    </div>
  )
}

export default AccountMenu
