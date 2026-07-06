import { useCallback, useEffect, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import {
  clearAdminSession,
  createPlayer,
  getAdminSession,
  listPlayers,
  setAdminSession,
  verifyAdminPassword,
} from '../lib/auth.js'
import './AdminGate.scss'

function AdminGate({ onOpenCampaign }) {
  const [adminPassword, setAdminPassword] = useState(getAdminSession())
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState(null)

  async function submitPassword(event) {
    event.preventDefault()
    setLoginError(null)
    try {
      const ok = await verifyAdminPassword(passwordInput)
      if (!ok) {
        setLoginError('Invalid admin password')
        return
      }
      setAdminSession(passwordInput)
      setAdminPassword(passwordInput)
    } catch (err) {
      setLoginError(err.message)
    }
  }

  function logOut() {
    clearAdminSession()
    setAdminPassword(null)
    setPasswordInput('')
  }

  if (!adminPassword) {
    return (
      <div className="admin-gate">
        <form className="admin-gate__form panel" onSubmit={submitPassword}>
          <h2>Admin</h2>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
          </div>
          {loginError && <p className="empty-state empty-state--error">{loginError}</p>}
          <button type="submit" className="btn btn--primary">
            Enter
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-gate">
      <div className="admin-gate__header">
        <h2>Admin</h2>
        <button type="button" className="btn btn--text" onClick={logOut}>
          Log out of admin
        </button>
      </div>
      <ManagePlayers adminPassword={adminPassword} />
      <h2 className="admin-gate__section-title">All Campaigns</h2>
      <Dashboard onOpenCampaign={onOpenCampaign} />
    </div>
  )
}

function ManagePlayers({ adminPassword }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState(null)

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPlayers(adminPassword)
      setPlayers(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [adminPassword])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  async function submitNewPlayer(event) {
    event.preventDefault()
    if (!username.trim() || !password) return
    setFormError(null)
    try {
      await createPlayer(username, password, adminPassword)
      setUsername('')
      setPassword('')
      await loadPlayers()
    } catch (err) {
      setFormError(err.message)
    }
  }

  return (
    <section className="manage-players panel">
      <h3>Manage Players</h3>
      <form className="manage-players__form" onSubmit={submitNewPlayer}>
        <div className="field">
          <label htmlFor="new-player-username">Username</label>
          <input
            id="new-player-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="thessaly"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-player-password">Password</label>
          <input
            id="new-player-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn--primary">
          + Add Player
        </button>
      </form>

      {formError && <p className="empty-state empty-state--error">{formError}</p>}
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && players.length === 0 && (
        <p className="empty-state">No players yet.</p>
      )}

      {!loading && !error && players.length > 0 && (
        <ul className="manage-players__list">
          {players.map((player) => (
            <li key={player.id}>{player.username}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AdminGate
