import { useState } from 'react'
import Modal from './Modal.jsx'
import { useImageCrop } from '../hooks/useImageCrop.jsx'
import { clearAvatar, setAvatar, usePlayerAvatar } from '../lib/profiles.js'
import './ProfilePictureDialog.scss'

// Upload, change or remove the logged-in player's profile picture. The
// picture is cropped to a circle first, and shows on the account button
// and to other players when you're online in a campaign.
function ProfilePictureDialog({ playerId, username, onClose }) {
  const url = usePlayerAvatar(playerId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const crop = useImageCrop({
    aspect: 1,
    shape: 'circle',
    onCropped: (file) => run(() => setAvatar(playerId, file)),
  })

  return (
    <Modal onClose={onClose} label="Profile picture">
      <div className="profile-picture">
        <h2 className="profile-picture__title">Profile picture</h2>
        <div className="profile-picture__preview">
          {url ? (
            <img src={url} alt={`${username || 'Your'} profile picture`} />
          ) : (
            <span aria-hidden="true">{username?.[0]?.toUpperCase() || '?'}</span>
          )}
        </div>
        <p className="profile-picture__hint">
          Shown on your account button and to your party when you’re online in a campaign.
        </p>
        {error && (
          <p className="profile-picture__error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-picture__actions">
          <label className={`btn btn--primary profile-picture__upload${busy ? ' is-busy' : ''}`}>
            {busy ? 'Saving…' : url ? 'Change picture' : 'Upload picture'}
            <input type="file" accept="image/*" onChange={crop.fromInput} disabled={busy} />
          </label>
          {url && (
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => clearAvatar(playerId))}>
              Remove
            </button>
          )}
          <button type="button" className="btn btn--text" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      {crop.dialog}
    </Modal>
  )
}

export default ProfilePictureDialog
