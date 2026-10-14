import { useEffect, useState } from 'react'
import { checkInvite, registerPlayer, setPlayerSession, verifyLogin } from '../lib/auth.js'
import { PasswordInput } from './ui.jsx'
import './PlayerLogin.scss'

const emptySignup = { username: '', displayName: '', email: '', password: '', confirm: '' }

const INVITE_PROBLEMS = {
  used: 'This invite link has already been used.',
  expired: 'This invite link has expired.',
  revoked: 'This invite link was cancelled.',
  invalid: 'This invite link isn’t valid.',
}

// The invite token from a sign-up link (…/?invite=TOKEN), if any.
function inviteFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('invite')?.trim() || ''
  } catch {
    return ''
  }
}

function clearInviteFromUrl() {
  window.history.replaceState(null, '', window.location.pathname)
}

// Accounts are by invite only: an invite link from the admin opens the
// sign-up form (username, name, email, password); without one, this is
// just the login.
function PlayerLogin({ onLoggedIn }) {
  const [token] = useState(inviteFromUrl)
  const [invite, setInvite] = useState(token ? { status: 'checking' } : null)
  const [mode, setMode] = useState(token ? 'signup' : 'login') // login | signup
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

  function finish(playerId, name) {
    if (token) clearInviteFromUrl()
    const session = { playerId, username: name.trim() }
    setPlayerSession(session)
    onLoggedIn(session)
  }

  function goToLogin() {
    clearInviteFromUrl()
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

  async function submitSignup(event) {
    event.preventDefault()
    setError(null)
    if (signup.password !== signup.confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      finish(await registerPlayer({ token, ...signup }), signup.username)
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

  return (
    <div className="player-login">
      <form className="player-login__form panel" onSubmit={submitLogin}>
        <h2>Log In</h2>
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
        <p className="player-login__note">New players need an invite link from their DM or the admin.</p>
      </form>
    </div>
  )
}

export default PlayerLogin
