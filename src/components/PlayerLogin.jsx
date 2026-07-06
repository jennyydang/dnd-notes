import { useState } from 'react'
import { setPlayerSession, verifyLogin } from '../lib/auth.js'
import './PlayerLogin.scss'

function PlayerLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function submitLogin(event) {
    event.preventDefault()
    setError(null)
    try {
      const playerId = await verifyLogin(username, password)
      const session = { playerId, username: username.trim() }
      setPlayerSession(session)
      onLoggedIn(session)
    } catch (err) {
      setError(err.message)
    }
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="empty-state empty-state--error">{error}</p>}
        <button type="submit" className="btn btn--primary">
          Log In
        </button>
      </form>
    </div>
  )
}

export default PlayerLogin
