import { useEffect, useState } from 'react'
import { checkPasswordReset, clearInviteFromUrl, completePasswordReset } from '../lib/auth.js'
import { PasswordInput } from './ui.jsx'
import './PlayerLogin.scss'

const PROBLEMS = {
  used: 'This reset link has already been used.',
  expired: 'This reset link has expired.',
  invalid: 'This reset link isn’t valid.',
}

// The page a reset link (…/?reset=TOKEN) opens: choose a new password.
// The admin makes these links for players who forgot theirs.
function ResetPassword({ token, onDone }) {
  const [reset, setReset] = useState({ status: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [doneFor, setDoneFor] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkPasswordReset(token)
      .then((r) => !cancelled && setReset(r))
      .catch((err) => !cancelled && setReset({ status: 'error', message: err.message }))
    return () => {
      cancelled = true
    }
  }, [token])

  function finish() {
    clearInviteFromUrl()
    onDone()
  }

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      setDoneFor(await completePasswordReset(token, password))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let body
  if (doneFor) {
    body = (
      <>
        <p className="player-login__lead" role="status">
          Your password is changed. Log in as <strong>{doneFor}</strong> with the new one.
        </p>
        <button type="button" className="btn btn--primary" onClick={finish}>
          Go to log in
        </button>
      </>
    )
  } else if (reset.status === 'checking') {
    body = (
      <p className="player-login__lead" role="status">
        Checking your link…
      </p>
    )
  } else if (reset.status !== 'ok') {
    body = (
      <>
        <p className="player-login__error" role="alert">
          {reset.status === 'error' ? reset.message : PROBLEMS[reset.status] || PROBLEMS.invalid} Use “Forgot
          password?” on the login to ask for a new one.
        </p>
        <button type="button" className="btn btn--primary" onClick={finish}>
          Go to log in
        </button>
      </>
    )
  } else {
    body = (
      <>
        <p className="player-login__lead">
          Choose a new password for <strong>{reset.username}</strong>.
        </p>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          <span className="player-login__hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="player-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </>
    )
  }

  return (
    <div className="player-login">
      <form className="player-login__form panel" onSubmit={submit}>
        <h2>Reset Password</h2>
        {body}
      </form>
    </div>
  )
}

export default ResetPassword
