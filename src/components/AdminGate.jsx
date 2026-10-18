import { useCallback, useEffect, useMemo, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import {
  clearAdminSession,
  createInvite,
  createPasswordReset,
  createPlayer,
  deletePlayer,
  dismissResetRequest,
  getAdminSession,
  listInvites,
  listPlayers,
  listResetRequests,
  resetLink,
  revokeInvite,
  deleteInvite,
  setAdminSession,
  updatePlayer,
  verifyAdminPassword,
} from '../lib/auth.js'
import { addPlayerToCampaign, listAllMemberships, setMembershipRole } from '../lib/campaigns.js'
import { getStored, setStored } from '../lib/sessionMode.js'
import { feedbackSolvedNotice, notifyPlayer } from '../lib/notifications.js'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import { PasswordInput } from './ui.jsx'
import Icon from './Icon.jsx'
import { InviteDialog, InviteList, LinkBox } from './InvitePlayers.jsx'
import './AdminGate.scss'

const SECTION_KEY = 'dnd-notes-admin-section'
const SECTIONS = ['campaigns', 'players', 'feedback']
const SECTION_TITLES = { campaigns: 'Campaigns', players: 'Players', feedback: 'Player feedback' }

const campaignFromRow = (r) => ({ id: r.id, name: r.name, archived: r.archived })
const feedbackFromRow = (r) => ({
  id: r.id,
  kind: r.kind,
  message: r.message,
  createdAt: r.created_at,
  status: r.status || 'open',
  solvedAt: r.solved_at || null,
  // Only whether the sender asked to hear back — never shown as a name.
  senderId: r.player_id || null,
})

function AdminGate({ onOpenCampaign }) {
  const [adminPassword, setAdminPassword] = useState(getAdminSession())

  if (!adminPassword) return <AdminLogin onLogin={setAdminPassword} />
  return (
    <AdminDashboard
      adminPassword={adminPassword}
      onOpenCampaign={onOpenCampaign}
      onLogOut={() => {
        clearAdminSession()
        setAdminPassword(null)
      }}
    />
  )
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!password || checking) return
    setError(null)
    setChecking(true)
    try {
      if (!(await verifyAdminPassword(password))) {
        setError('That password isn’t right.')
        return
      }
      setAdminSession(password)
      onLogin(password)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="admin-gate">
      <form className="admin-gate__form panel" onSubmit={submit}>
        <span className="admin-gate__crest" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <h2>Admin</h2>
        <p className="admin-gate__hint">Manage campaigns, players and feedback.</p>
        <div className="field">
          <label htmlFor="admin-password">Admin password</label>
          <PasswordInput
            id="admin-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            autoComplete="current-password"
            autoFocus
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!password || checking}>
          {checking ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}

// Players and their campaign memberships, loaded together (both come from
// admin-only RPCs/views rather than a single table).
function usePlayers(adminPassword) {
  const [players, setPlayers] = useState([])
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [playersData, membershipsData] = await Promise.all([listPlayers(adminPassword), listAllMemberships()])
      setPlayers(playersData)
      setMemberships(membershipsData)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [adminPassword])

  useEffect(() => {
    reload()
  }, [reload])

  return { players, memberships, loading, error, reload }
}

// Open "Forgot password?" requests, checked now and then.
function useResetRequests(adminPassword) {
  const [requests, setRequests] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      setRequests(await listResetRequests(adminPassword))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [adminPassword])

  useEffect(() => {
    reload()
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), 60000)
    return () => clearInterval(timer)
  }, [reload])

  return { requests, error, reload }
}

const formatWhen = (value) =>
  new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function AdminDashboard({ adminPassword, onOpenCampaign, onLogOut }) {
  const [section, setSectionState] = useState(() => {
    const saved = getStored(SECTION_KEY, 'campaigns')
    return SECTIONS.includes(saved) ? saved : 'campaigns'
  })
  const setSection = (id) => {
    setSectionState(id)
    setStored(SECTION_KEY, id)
  }

  const playerData = usePlayers(adminPassword)
  const resets = useResetRequests(adminPassword)
  const { items: campaigns } = useSupabaseTable('campaigns', { fromRow: campaignFromRow })
  const feedback = useSupabaseTable('feedback', { fromRow: feedbackFromRow, ascending: false })

  const activeCampaigns = campaigns.filter((c) => !c.archived).length
  const archivedCampaigns = campaigns.length - activeCampaigns
  const playersWithCampaigns = new Set(playerData.memberships.map((m) => m.playerId))
  const unassigned = playerData.players.filter((p) => !playersWithCampaigns.has(p.id)).length
  const issues = feedback.items.filter((f) => f.kind === 'issue' && f.status !== 'solved').length

  const stats = [
    {
      id: 'campaigns',
      icon: 'map',
      label: 'Campaigns',
      value: activeCampaigns,
      detail: archivedCampaigns ? `${archivedCampaigns} archived` : 'All active',
    },
    {
      id: 'players',
      icon: 'users',
      label: 'Players',
      value: playerData.loading ? '–' : playerData.players.length,
      detail: resets.requests.length
        ? `${resets.requests.length} password reset${resets.requests.length === 1 ? '' : 's'} requested`
        : unassigned
          ? `${unassigned} not in a campaign`
          : 'All in a campaign',
      attention: unassigned > 0 || resets.requests.length > 0,
    },
    {
      id: 'feedback',
      icon: 'inbox',
      label: 'Feedback',
      value: feedback.loading ? '–' : feedback.items.filter((f) => f.status !== 'solved').length,
      detail: issues ? `${issues} issue${issues === 1 ? '' : 's'} reported` : 'No open issues',
      attention: issues > 0,
    },
  ]

  return (
    <div className="admin-gate admin-dash">
      <header className="admin-dash__header">
        <div>
          <h2 className="admin-dash__title">Admin dashboard</h2>
          <p className="admin-dash__subtitle">Pick a section below.</p>
        </div>
        <button type="button" className="btn btn--text" onClick={onLogOut}>
          Log out
        </button>
      </header>

      {/* The summary tiles double as the section switcher. */}
      <div className="admin-dash__stats" role="tablist" aria-label="Admin sections">
        {stats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            role="tab"
            aria-selected={section === stat.id}
            className={`admin-stat panel${section === stat.id ? ' admin-stat--active' : ''}${stat.attention ? ' admin-stat--attention' : ''}`}
            onClick={() => setSection(stat.id)}
          >
            <span className="admin-stat__label">
              <Icon name={stat.icon} /> {stat.label}
            </span>
            <span className="admin-stat__value">{stat.value}</span>
            <span className="admin-stat__detail">{stat.detail}</span>
          </button>
        ))}
      </div>

      <div key={section} className="admin-dash__section campaign-view__screen" role="tabpanel">
        <h3 className="admin-dash__section-title">{SECTION_TITLES[section]}</h3>
        {section === 'campaigns' && <Dashboard onOpenCampaign={onOpenCampaign} />}
        {section === 'players' && (
          <ManagePlayers adminPassword={adminPassword} campaigns={campaigns} resets={resets} {...playerData} />
        )}
        {section === 'feedback' && <FeedbackInbox {...feedback} />}
      </div>
    </div>
  )
}

const emptyPlayerForm = { username: '', password: '', campaignId: '' }

function ManagePlayers({ adminPassword, campaigns, resets, players, memberships, loading, error, reload }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyPlayerForm)
  const [editing, setEditing] = useState(null) // { id, username, password }
  const [formError, setFormError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invitesChanged, setInvitesChanged] = useState(0)
  const [resetFor, setResetFor] = useState(null) // { player, link?, error? }
  const joinableCampaigns = campaigns.filter((c) => !c.archived)

  const membershipsByPlayer = useMemo(() => {
    const map = {}
    for (const m of memberships) (map[m.playerId] ||= []).push(m)
    for (const list of Object.values(map)) list.sort((a, b) => a.campaignName.localeCompare(b.campaignName))
    return map
  }, [memberships])

  const visiblePlayers = players
    .filter((p) => p.username.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username))

  function openAdd() {
    setForm(emptyPlayerForm)
    setFormError(null)
    setAdding(true)
  }

  function openEdit(player) {
    setEditing({ id: player.id, username: player.username, password: '' })
    setFormError(null)
  }

  function closeForms() {
    setAdding(false)
    setEditing(null)
    setFormError(null)
  }

  async function submitNewPlayer(event) {
    event.preventDefault()
    if (!form.username.trim() || !form.password || saving) return
    setFormError(null)
    setSaving(true)
    try {
      const newPlayerId = await createPlayer(form.username.trim(), form.password, adminPassword)
      if (form.campaignId) {
        try {
          await addPlayerToCampaign(newPlayerId, form.campaignId)
        } catch (err) {
          setActionError(`${form.username} was created, but couldn’t be added to that campaign: ${err.message}`)
        }
      }
      closeForms()
      await reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit(event) {
    event.preventDefault()
    if (!editing.username.trim() || saving) return
    setSaving(true)
    try {
      await updatePlayer(editing.id, editing.username.trim(), editing.password, adminPassword)
      closeForms()
      await reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Runs an action on a player card and refreshes; errors show above the list.
  async function run(action) {
    setActionError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  // A single-use link (24 hours) the admin sends to a player who's
  // forgotten their password. Passwords can't be shown — only reset.
  async function makeResetLink(player) {
    setResetFor({ player })
    try {
      const token = await createPasswordReset(player.id, adminPassword)
      setResetFor({ player, link: resetLink(token) })
      resets.reload()
    } catch (err) {
      setResetFor({ player, error: err.message })
    }
  }

  async function dismissRequest(request) {
    setActionError(null)
    try {
      await dismissResetRequest(request.id, adminPassword)
      resets.reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  function removePlayer(player) {
    const confirmed = window.confirm(
      `Delete player "${player.username}"? This removes their access to every campaign they've joined. Campaigns they created stay, just without an owner.`,
    )
    if (confirmed) run(() => deletePlayer(player.id, adminPassword))
  }

  return (
    <section className="manage-players">
      <div className="admin-dash__toolbar">
        {players.length > 3 ? (
          <input
            type="search"
            className="admin-dash__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a player…"
            aria-label="Find a player"
          />
        ) : (
          <span />
        )}
        <div className="manage-players__add">
          <button type="button" className="btn" onClick={() => setInviting(true)}>
            <Icon name="send" /> Invite by link
          </button>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Add Player
          </button>
        </div>
      </div>

      {inviting && (
        <InviteDialog
          create={(invite) => createInvite(invite, adminPassword)}
          campaigns={campaigns}
          onClose={() => {
            setInviting(false)
            reload()
          }}
          onCreated={() => setInvitesChanged((n) => n + 1)}
        />
      )}
      {resets.requests.length > 0 && (
        <section className="reset-requests panel" aria-labelledby="reset-requests-title">
          <h4 id="reset-requests-title" className="reset-requests__title">
            <Icon name="alert" /> Password reset requests
          </h4>
          <ul className="reset-requests__list">
            {resets.requests.map((r) => (
              <li key={r.id} className="reset-requests__item">
                <span className="reset-requests__who">
                  <strong>{r.display_name || r.username}</strong> @{r.username}
                  {r.email && <span className="reset-requests__email"> · {r.email}</span>}
                  <span className="reset-requests__when"> · {formatWhen(r.created_at)}</span>
                </span>
                <span className="reset-requests__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => makeResetLink({ id: r.player_id, username: r.username, email: r.email })}
                  >
                    Create reset link
                  </button>
                  <button type="button" className="btn btn--text" onClick={() => dismissRequest(r)}>
                    Dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {resets.error && <p className="empty-state empty-state--error">{resets.error}</p>}

      {resetFor && (
        <Modal onClose={() => setResetFor(null)} label={`Reset link for ${resetFor.player.username}`} size="narrow">
          <div className="form-stack reset-link">
            <h3 className="section-card__title">Reset link for {resetFor.player.username}</h3>
            {resetFor.error ? (
              <p className="empty-state empty-state--error">{resetFor.error}</p>
            ) : !resetFor.link ? (
              <p className="empty-state">Making a link…</p>
            ) : (
              <>
                <p className="reset-link__note">
                  Send this to {resetFor.player.username}
                  {resetFor.player.email ? ` (${resetFor.player.email})` : ''}. It works once, for 24 hours, and lets
                  them choose a new password. Any older reset link for them stops working.
                </p>
                <LinkBox
                  link={resetFor.link}
                  id="reset-link-url"
                  label="Password reset link"
                  shareTitle="Reset your Adventurer’s Log password"
                  shareText="Your link to choose a new Adventurer’s Log password"
                />
              </>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={() => setResetFor(null)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      <InviteList
        load={() => listInvites(adminPassword)}
        revoke={(id) => revokeInvite(id, adminPassword)}
        remove={(id) => deleteInvite(id, adminPassword)}
        refreshKey={invitesChanged}
        onChanged={reload}
      />

      {actionError && (
        <p className="empty-state empty-state--error" role="alert">
          {actionError}
        </p>
      )}
      {loading && <p className="empty-state">Loading players…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}
      {!loading && !error && visiblePlayers.length === 0 && (
        <p className="empty-state">
          {query.trim() ? `No players match “${query.trim()}”.` : 'No players yet. Add one to give them a login.'}
        </p>
      )}

      {!loading && !error && visiblePlayers.length > 0 && (
        <ul className="manage-players__list">
          {visiblePlayers.map((player) => {
            const playerCampaigns = membershipsByPlayer[player.id] || []
            const joined = new Set(playerCampaigns.map((m) => m.campaignId))
            const canJoin = joinableCampaigns.filter((c) => !joined.has(c.id))
            return (
              <li key={player.id} className="player-card panel">
                <header className="player-card__header">
                  <span className="player-card__avatar" aria-hidden="true">
                    {player.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="player-card__who">
                    <h3 className="player-card__name">{player.username}</h3>
                    {(player.display_name || player.email) && (
                      <p className="player-card__contact">
                        {[player.display_name, player.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="player-card__count">
                      {playerCampaigns.length === 0
                        ? 'Not in any campaign'
                        : `${playerCampaigns.length} campaign${playerCampaigns.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </header>

                {playerCampaigns.length > 0 && (
                  <ul className="player-card__campaigns" aria-label={`${player.username}'s campaigns`}>
                    {playerCampaigns.map((m) => {
                      const creator = m.isCreator || m.role === 'creator'
                      const dm = m.role === 'dm'
                      return (
                        <li key={m.campaignId} className={`player-card__campaign${dm ? ' is-dm' : ''}`}>
                          <span className="player-card__campaign-name" title={m.campaignName}>
                            {m.campaignName}
                          </span>
                          {creator && <span className="player-card__tag">Creator</span>}
                          {/* DM on/off: shows the role and changes it in one tap. */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dm}
                            className={`dm-switch${dm ? ' is-on' : ''}`}
                            title={dm ? `${player.username} is a DM here — tap to make them a player` : `Make ${player.username} a DM here`}
                            aria-label={`${player.username} is DM of ${m.campaignName}`}
                            onClick={() =>
                              run(() => setMembershipRole(player.id, m.campaignId, !dm ? 'dm' : creator ? 'creator' : 'player'))
                            }
                          >
                            <span className="dm-switch__track" aria-hidden="true">
                              <span className="dm-switch__thumb" />
                            </span>
                            <span className="dm-switch__label">DM</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {canJoin.length > 0 && (
                  <label className="player-card__add-campaign">
                    <Icon name="plus" />
                    <select
                      value=""
                      onChange={(e) => e.target.value && run(() => addPlayerToCampaign(player.id, e.target.value))}
                      aria-label={`Add ${player.username} to a campaign`}
                    >
                      <option value="">Add to a campaign…</option>
                      {canJoin.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="player-card__actions">
                  <button
                    type="button"
                    className="player-card__action"
                    onClick={() => makeResetLink(player)}
                    title="A single-use link for them to choose a new password"
                  >
                    <Icon name="link" /> Reset link
                  </button>
                  <button type="button" className="player-card__action" onClick={() => openEdit(player)}>
                    <Icon name="edit" /> Edit
                  </button>
                  <button
                    type="button"
                    className="player-card__action player-card__action--danger"
                    onClick={() => removePlayer(player)}
                  >
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <Modal onClose={closeForms} label="Add Player">
          <form className="admin-form form-stack" onSubmit={submitNewPlayer}>
            <h3 className="section-card__title">Add Player</h3>
            <div className="field">
              <label htmlFor="new-player-username">Username</label>
              <input
                id="new-player-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="thessaly"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-player-password">Password</label>
              <PasswordInput
                id="new-player-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-player-campaign">Add to campaign</label>
              <select
                id="new-player-campaign"
                value={form.campaignId}
                onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
              >
                <option value="">None — they can join with a code</option>
                {joinableCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={closeForms}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal onClose={closeForms} label="Edit Player">
          <form className="admin-form form-stack" onSubmit={submitEdit}>
            <h3 className="section-card__title">Edit Player</h3>
            <div className="field">
              <label htmlFor="edit-player-username">Username</label>
              <input
                id="edit-player-username"
                type="text"
                value={editing.username}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-player-password">New password</label>
              <PasswordInput
                id="edit-player-password"
                value={editing.password}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                placeholder="Leave blank to keep the current one"
                autoComplete="new-password"
              />
            </div>
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--text" onClick={closeForms}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

const FEEDBACK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'issue', label: 'Issues' },
  { id: 'suggestion', label: 'Suggestions' },
]

function formatFeedbackDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Who sent each submission is never shown. Players who asked to hear back
// are recorded on it (senderId), so "Solved" can notify them; for the
// rest, Solved just marks it done. Solved feedback moves to Archived,
// where it can be reopened. Dismissing deletes a submission.
function FeedbackInbox({ items: submissions, loading, error, removeItem, updateItem }) {
  const [filter, setFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [dismissError, setDismissError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notices, setNotices] = useState({}) // id → { ok, text }
  const [flash, setFlash] = useState(null) // { ok, text } after solving or reopening
  const archivedCount = submissions.filter((s) => s.status === 'solved').length
  const inView = submissions.filter((s) => (s.status === 'solved') === showArchived)
  const counts = {
    all: inView.length,
    issue: inView.filter((s) => s.kind === 'issue').length,
    suggestion: inView.filter((s) => s.kind !== 'issue').length,
  }
  const visible = inView.filter(
    (s) => filter === 'all' || (filter === 'issue' ? s.kind === 'issue' : s.kind !== 'issue'),
  )
  const preview = (item) => {
    const text = item.message.trim().replace(/\s+/g, ' ')
    return text.length > 60 ? `${text.slice(0, 57)}…` : text
  }

  async function dismiss(item) {
    setDismissError(null)
    try {
      await removeItem(item.id)
    } catch (err) {
      setDismissError(err.message)
    }
  }

  async function solve(item) {
    setBusyId(item.id)
    setFlash(null)
    setNotices((n) => ({ ...n, [item.id]: null }))
    try {
      await updateItem(item.id, { status: 'solved', solved_at: new Date().toISOString() })
    } catch (err) {
      const text = /status|solved_at/.test(err.message)
        ? 'Run the latest supabase/schema.sql first (it adds solved feedback and notifications).'
        : err.message
      setNotices((n) => ({ ...n, [item.id]: { ok: false, text: `Couldn’t mark it solved: ${text}` } }))
      setBusyId(null)
      return
    }
    const solved = `Solved and archived “${preview(item)}”.`
    if (item.senderId) {
      try {
        await notifyPlayer(item.senderId, feedbackSolvedNotice(item))
        setFlash({ ok: true, text: `${solved} The sender has been notified.` })
      } catch (err) {
        setFlash({ ok: false, text: `${solved} Couldn’t notify the sender: ${err.message}` })
      }
    } else {
      setFlash({ ok: true, text: solved })
    }
    setBusyId(null)
  }

  async function reopen(item) {
    setBusyId(item.id)
    setFlash(null)
    try {
      await updateItem(item.id, { status: 'open', solved_at: null })
      setNotices((n) => ({ ...n, [item.id]: null }))
      setFlash({ ok: true, text: `Reopened “${preview(item)}”. It’s back in the inbox.` })
    } catch (err) {
      setNotices((n) => ({ ...n, [item.id]: { ok: false, text: err.message } }))
    } finally {
      setBusyId(null)
    }
  }

  function toggleArchived() {
    setShowArchived((v) => !v)
    setFlash(null)
  }

  return (
    <section className="feedback-inbox">
      {submissions.length > 0 && (
        <div className="feedback-inbox__toolbar">
          <TabNav
            tabs={FEEDBACK_FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
            activeTab={filter}
            onSelect={setFilter}
            className="tab-nav--pill feedback-inbox__filter"
            label="Filter feedback"
          />
          <button type="button" className="btn btn--text" onClick={toggleArchived}>
            {showArchived ? '← Back to inbox' : `Archived (${archivedCount})`}
          </button>
        </div>
      )}
      {showArchived && <h3 className="feedback-inbox__heading">Archived — solved feedback</h3>}
      {flash && (
        <p className={`feedback-inbox__notice${flash.ok ? '' : ' feedback-inbox__notice--error'}`} role="status">
          {flash.text}
        </p>
      )}

      {dismissError && <p className="empty-state empty-state--error">Couldn’t dismiss: {dismissError}</p>}
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          {submissions.length === 0
            ? 'Inbox zero. Issues and suggestions players send will land here.'
            : showArchived
              ? `Nothing archived${filter === 'all' ? '' : ` in ${filter === 'issue' ? 'issues' : 'suggestions'}`} yet. Solved feedback goes here.`
              : inView.length === 0
                ? 'Inbox zero. Everything’s been solved — see Archived.'
                : `No open ${filter === 'issue' ? 'issues' : 'suggestions'}.`}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="feedback-inbox__list">
          {visible.map((item) => (
            <li
              key={item.id}
              className={`feedback-inbox__item panel feedback-inbox__item--${item.kind}${
                item.status === 'solved' ? ' feedback-inbox__item--solved' : ''
              }`}
            >
              <div className="feedback-inbox__meta">
                <span className={`feedback-inbox__badge feedback-inbox__badge--${item.kind}`}>
                  <Icon name={item.kind === 'issue' ? 'bug' : 'lightbulb'} /> {item.kind === 'issue' ? 'Issue' : 'Suggestion'}
                </span>
                {item.status === 'solved' && (
                  <span className="feedback-inbox__badge feedback-inbox__badge--solved">
                    <Icon name="check-square" /> Solved
                    {item.solvedAt ? ` · ${formatFeedbackDate(item.solvedAt)}` : ''}
                  </span>
                )}
                <span className="feedback-inbox__date">{formatFeedbackDate(item.createdAt)}</span>
                {item.senderId && item.status !== 'solved' && (
                  <span className="feedback-inbox__date">· Sender asked to hear back</span>
                )}
              </div>
              <p className="feedback-inbox__message">{item.message}</p>
              {notices[item.id] && (
                <p
                  className={`feedback-inbox__notice${notices[item.id].ok ? '' : ' feedback-inbox__notice--error'}`}
                  role="status"
                >
                  {notices[item.id].text}
                </p>
              )}
              <div className="feedback-inbox__actions">
                {item.status === 'solved' ? (
                  <button
                    type="button"
                    className="btn btn--text"
                    disabled={busyId === item.id}
                    onClick={() => reopen(item)}
                    title="Move it back to the inbox"
                  >
                    Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busyId === item.id}
                    onClick={() => solve(item)}
                    title={item.senderId ? 'Marks it solved, notifies the sender and archives it' : 'Marks it solved and archives it'}
                  >
                    {busyId === item.id ? 'Saving…' : 'Solved'}
                  </button>
                )}
                <button type="button" className="btn btn--text" onClick={() => dismiss(item)}>
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AdminGate
