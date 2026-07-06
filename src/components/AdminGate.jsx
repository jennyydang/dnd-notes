import { useCallback, useEffect, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import {
  clearAdminSession,
  createPlayer,
  deletePlayer,
  getAdminSession,
  listPlayers,
  setAdminSession,
  updatePlayer,
  verifyAdminPassword,
} from '../lib/auth.js'
import { listAllMemberships } from '../lib/campaigns.js'
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
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [playersData, membershipsData] = await Promise.all([
        listPlayers(adminPassword),
        listAllMemberships(),
      ])
      setPlayers(playersData)
      setMemberships(membershipsData)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [adminPassword])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function submitNewPlayer(event) {
    event.preventDefault()
    if (!username.trim() || !password) return
    setFormError(null)
    try {
      await createPlayer(username, password, adminPassword)
      setUsername('')
      setPassword('')
      await loadAll()
    } catch (err) {
      setFormError(err.message)
    }
  }

  function startEditing(player) {
    setEditingId(player.id)
    setEditUsername(player.username)
    setEditPassword('')
    setEditError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditUsername('')
    setEditPassword('')
    setEditError(null)
  }

  async function submitEdit(event, playerId) {
    event.preventDefault()
    if (!editUsername.trim()) return
    try {
      await updatePlayer(playerId, editUsername, editPassword, adminPassword)
      cancelEditing()
      await loadAll()
    } catch (err) {
      setEditError(err.message)
    }
  }

  async function removePlayer(player) {
    const confirmed = window.confirm(
      `Delete player "${player.username}"? This removes their access to every campaign they've joined. Campaigns they created stay, just without an owner.`,
    )
    if (!confirmed) return
    try {
      await deletePlayer(player.id, adminPassword)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const membershipsByPlayer = {}
  for (const m of memberships) {
    if (!membershipsByPlayer[m.playerId]) membershipsByPlayer[m.playerId] = []
    membershipsByPlayer[m.playerId].push(m)
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
          {players.map((player) => {
            const playerCampaigns = membershipsByPlayer[player.id] || []
            return (
              <li key={player.id} className="manage-players__player">
                {editingId === player.id ? (
                  <form
                    className="manage-players__edit-form"
                    onSubmit={(e) => submitEdit(e, player.id)}
                  >
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      aria-label="Username"
                      required
                    />
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="New password (optional)"
                      aria-label="New password"
                    />
                    <button type="submit" className="btn btn--primary">
                      Save
                    </button>
                    <button type="button" className="btn btn--text" onClick={cancelEditing}>
                      Cancel
                    </button>
                    {editError && (
                      <p className="empty-state empty-state--error">{editError}</p>
                    )}
                  </form>
                ) : (
                  <div className="manage-players__row">
                    <span className="manage-players__username">{player.username}</span>
                    <div className="manage-players__row-actions">
                      <button
                        type="button"
                        className="btn btn--text"
                        onClick={() => startEditing(player)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => removePlayer(player)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="manage-players__campaigns">
                  {playerCampaigns.length === 0 ? (
                    <span className="manage-players__no-campaigns">No campaigns yet</span>
                  ) : (
                    playerCampaigns.map((m) => (
                      <span key={m.campaignId} className="manage-players__campaign-badge">
                        {m.campaignName}
                        {m.joinCode && (
                          <span className="manage-players__join-code">{m.joinCode}</span>
                        )}
                        <span className="manage-players__role">{m.role}</span>
                      </span>
                    ))
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default AdminGate
