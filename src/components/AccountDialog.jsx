import { useEffect, useState } from 'react'
import {
  PLAYER_SESSION_CHANGED,
  getMyAccount,
  getPlayerSession,
  setPlayerSession,
  updateMyAccount,
} from '../lib/auth.js'
import Modal from './Modal.jsx'
import { PasswordInput } from './ui.jsx'
import './AccountDialog.scss'

const empty = { username: '', displayName: '', email: '', newPassword: '', confirm: '', currentPassword: '' }

// A player changing their own username, name, email or password. Every
// change is confirmed with their current password.
function AccountDialog({ playerId, onClose }) {
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState(empty)
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyAccount(playerId)
      .then((a) => {
        if (cancelled) return
        setAccount(a)
        setForm((f) => ({ ...f, username: a.username, displayName: a.displayName }))
      })
      .catch((err) => !cancelled && setLoadError(err.message))
    return () => {
      cancelled = true
    }
  }, [playerId])

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setSaved(false)
      setForm((f) => ({ ...f, [key]: e.target.value }))
    },
  })

  const changed =
    account &&
    (form.username.trim() !== account.username ||
      form.displayName.trim() !== account.displayName ||
      form.email.trim() !== '' ||
      form.newPassword !== '')

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (!changed) {
      setError('Nothing to save yet — change something first.')
      return
    }
    if (form.newPassword && form.newPassword !== form.confirm) {
      setError('The two new passwords don’t match.')
      return
    }
    setSaving(true)
    try {
      const username = form.username.trim()
      await updateMyAccount(playerId, {
        currentPassword: form.currentPassword,
        username: username !== account.username ? username : null,
        displayName: form.displayName.trim() !== account.displayName ? form.displayName : null,
        email: form.email,
        newPassword: form.newPassword,
      })
      if (username !== account.username) {
        const session = getPlayerSession()
        if (session?.playerId === playerId) {
          setPlayerSession({ ...session, username })
          window.dispatchEvent(new Event(PLAYER_SESSION_CHANGED))
        }
      }
      const fresh = await getMyAccount(playerId).catch(() => null)
      if (fresh) setAccount(fresh)
      setForm((f) => ({ ...empty, username: fresh?.username ?? username, displayName: fresh?.displayName ?? f.displayName }))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} label="Account">
      <form className="account-dialog form-stack" onSubmit={submit} noValidate>
        <h3 className="section-card__title">Account</h3>
        {loadError && <p className="empty-state empty-state--error">{loadError}</p>}
        {!account && !loadError && <p className="empty-state">Loading…</p>}
        {account && (
          <>
            <div className="field">
              <label htmlFor="account-username">Username</label>
              <input
                id="account-username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                maxLength={30}
                {...field('username')}
              />
              <span className="account-dialog__hint">What you log in with. 3–30 letters, numbers, . - _</span>
            </div>
            <div className="field">
              <label htmlFor="account-name">Name</label>
              <input id="account-name" type="text" autoComplete="name" maxLength={60} {...field('displayName')} />
            </div>
            <div className="field">
              <label htmlFor="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={account.emailHint ? `Current: ${account.emailHint}` : 'Add an email'}
                {...field('email')}
              />
              <span className="account-dialog__hint">Leave blank to keep your current email.</span>
            </div>
            <div className="field">
              <label htmlFor="account-new-password">New password</label>
              <PasswordInput id="account-new-password" autoComplete="new-password" placeholder="Leave blank to keep it" {...field('newPassword')} />
            </div>
            {form.newPassword && (
              <div className="field">
                <label htmlFor="account-confirm">Confirm new password</label>
                <PasswordInput id="account-confirm" autoComplete="new-password" {...field('confirm')} />
              </div>
            )}
            <div className="field account-dialog__current">
              <label htmlFor="account-current">Current password</label>
              <PasswordInput id="account-current" autoComplete="current-password" required {...field('currentPassword')} />
              <span className="account-dialog__hint">Needed to save any change.</span>
            </div>
            {error && (
              <p className="account-dialog__error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="account-dialog__saved" role="status">
                Saved.
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={onClose}>
                {saved ? 'Done' : 'Cancel'}
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving || !form.currentPassword}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

export default AccountDialog
