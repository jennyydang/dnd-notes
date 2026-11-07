import { useEffect, useState } from 'react'
import {
  checkInvite,
  clearInviteFromUrl,
  inviteFromUrl,
  registerPlayer,
  requestPasswordReset,
  setPlayerSession,
  verifyLogin,
} from '../lib/auth.js'
import { PasswordInput } from './ui.jsx'
import './PlayerLogin.scss'

const emptySignup = { username: '', displayName: '', email: '', password: '', confirm: '' }

const INVITE_PROBLEMS = {
  used: 'This invite link has already been used.',
  expired: 'This invite link has expired.',
  revoked: 'This invite link was cancelled.',
  invalid: 'This invite link isn’t valid.',
}

// Accounts are by invite only: an invite link from the admin opens the
// sign-up form (username, name, email, password); without one, this is
// just the login. Someone who already has an account can log in from a
// campaign's invite link instead, and the dashboard offers to join it.
function PlayerLogin({ onLoggedIn }) {
  const [token] = useState(inviteFromUrl)
  const [invite, setInvite] = useState(token ? { status: 'checking' } : null)
  const [mode, setMode] = useState(token ? 'signup' : 'login') // login | signup | forgot
  const [forgotFor, setForgotFor] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [signup, setSignup] = useState(emptySignup)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    checkInvite(token)
      .then((result) => !cancelled && setInvite(result))
      .catch((err) => !cancelled && setInvite({ status: 'error', message: err.message }))
    return () => {
      cancelled = true
    }
  }, [token])

  // A valid link for a campaign stays in the URL through a login, so the
  // dashboard can offer to join it.
  const joinable = invite?.status === 'ok' && Boolean(invite.campaignName)

  function finish(playerId, name, signedUp = false) {
    if (token && (signedUp || !joinable)) clearInviteFromUrl()
    const session = { playerId, username: name.trim() }
    setPlayerSession(session)
    onLoggedIn(session)
  }

  function goToLogin() {
    if (!joinable) clearInviteFromUrl()
    setMode('login')
    setError(null)
  }

  async function submitLogin(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      finish(await verifyLogin(username, password), username)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function openForgot() {
    setForgotFor(username)
    setForgotSent(false)
    setError(null)
    setMode('forgot')
  }

  async function submitForgot(event) {
    event.preventDefault()
    if (!forgotFor.trim()) return
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(forgotFor)
      setForgotSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitSignup(event) {
    event.preventDefault()
    setError(null)
    if (signup.password !== signup.confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      finish(await registerPlayer({ token, ...signup }), signup.username, true)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const field = (key) => ({
    value: signup[key],
    onChange: (e) => setSignup((s) => ({ ...s, [key]: e.target.value })),
  })

  if (mode === 'signup' && invite?.status !== 'ok') {
    const problem = invite?.status === 'error' ? invite.message : INVITE_PROBLEMS[invite?.status]
    return (
      <div className="player-login">
        <div className="player-login__form panel">
          <h2>Create an Account</h2>
          {invite?.status === 'checking' ? (
            <p className="player-login__lead" role="status">
              Checking your invite…
            </p>
          ) : (
            <>
              <p className="player-login__error" role="alert">
                {problem} Ask whoever invited you for a new link.
              </p>
              <p className="player-login__switch">
                Already have an account?{' '}
                <button type="button" className="player-login__link" onClick={goToLogin}>
                  Log in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'signup') {
    return (
      <div className="player-login">
        <form className="player-login__form panel" onSubmit={submitSignup}>
          <h2>Create an Account</h2>
          <p className="player-login__lead">
            {invite.campaignName ? (
              <>
                You’re invited to join <strong>{invite.campaignName}</strong>.
              </>
            ) : (
              'You’re invited to Adventurer’s Log. Join a campaign afterwards with the code from your DM.'
            )}
          </p>
          <div className="field">
            <label htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_.\-]+"
              title="Letters, numbers, dots, dashes or underscores"
              aria-describedby="signup-username-hint"
              autoFocus
              required
              {...field('username')}
            />
            <span id="signup-username-hint" className="player-login__hint">
              What you’ll log in with. 3–30 letters, numbers, . - _
            </span>
          </div>
          <div className="field">
            <label htmlFor="signup-name">Name</label>
            <input id="signup-name" type="text" autoComplete="name" maxLength={60} required {...field('displayName')} />
          </div>
          <div className="field">
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" type="email" autoComplete="email" inputMode="email" required {...field('email')} />
          </div>
          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <PasswordInput
              id="signup-password"
              autoComplete="new-password"
              minLength={8}
              aria-describedby="signup-password-hint"
              required
              {...field('password')}
            />
            <span id="signup-password-hint" className="player-login__hint">
              At least 8 characters.
            </span>
          </div>
          <div className="field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <PasswordInput id="signup-confirm" autoComplete="new-password" required {...field('confirm')} />
          </div>
          {error && (
            <p className="player-login__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create Account'}
          </button>
          <p className="player-login__switch">
            Already have an account?{' '}
            <button type="button" className="player-login__link" onClick={goToLogin}>
              Log in
            </button>
          </p>
        </form>
      </div>
    )
  }

  if (mode === 'forgot') {
    return (
      <div className="player-login">
        <form className="player-login__form panel" onSubmit={submitForgot}>
          <h2>Forgot Password</h2>
          {forgotSent ? (
            <p className="player-login__lead" role="status">
              Thanks — if that account exists, the admin has been asked to reset it. They’ll send you a link to
              choose a new password.
            </p>
          ) : (
            <>
              <p className="player-login__lead">
                Enter your username or email. The admin will send you a link to set a new password.
              </p>
              <div className="field">
                <label htmlFor="forgot-identifier">Username or email</label>
                <input
                  id="forgot-identifier"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  value={forgotFor}
                  onChange={(e) => setForgotFor(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && (
                <p className="player-login__error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn--primary" disabled={busy || !forgotFor.trim()}>
                {busy ? 'Sending…' : 'Ask for a reset link'}
              </button>
            </>
          )}
          <p className="player-login__switch">
            <button type="button" className="player-login__link" onClick={() => setMode('login')}>
              ← Back to log in
            </button>
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="player-login">
      <form className="player-login__form panel" onSubmit={submitLogin}>
        <h2>Log In</h2>
        {joinable && (
          <p className="player-login__lead">
            Log in to join <strong>{invite.campaignName}</strong>.
          </p>
        )}
        <div className="field">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="player-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log In'}
        </button>
        <p className="player-login__switch">
          <button type="button" className="player-login__link" onClick={openForgot}>
            Forgot password?
          </button>
        </p>
        {joinable ? (
          <p className="player-login__switch">
            New here?{' '}
            <button type="button" className="player-login__link" onClick={() => setMode('signup')}>
              Create an account
            </button>
          </p>
        ) : (
          <p className="player-login__note">New players need an invite link from their DM or the admin.</p>
        )}
      </form>
    </div>
  )
}

export default PlayerLogin
