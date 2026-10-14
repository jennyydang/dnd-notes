import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { addPlayerToCampaign, listAllMemberships, setMembershipRole } from '../lib/campaigns.js'
import { getStored, setStored } from '../lib/sessionMode.js'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import Modal from './Modal.jsx'
import TabNav from './TabNav.jsx'
import { PasswordInput } from './ui.jsx'
import Icon from './Icon.jsx'
import './AdminGate.scss'

const SECTION_KEY = 'dnd-notes-admin-section'
const SECTIONS = ['campaigns', 'players', 'feedback']
const SECTION_TITLES = { campaigns: 'Campaigns', players: 'Players', feedback: 'Player feedback' }

const campaignFromRow = (r) => ({ id: r.id, name: r.name, archived: r.archived })
const feedbackFromRow = (r) => ({ id: r.id, kind: r.kind, message: r.message, createdAt: r.created_at })

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
  const { items: campaigns } = useSupabaseTable('campaigns', { fromRow: campaignFromRow })
  const feedback = useSupabaseTable('feedback', { fromRow: feedbackFromRow, ascending: false })

  const activeCampaigns = campaigns.filter((c) => !c.archived).length
  const archivedCampaigns = campaigns.length - activeCampaigns
  const playersWithCampaigns = new Set(playerData.memberships.map((m) => m.playerId))
  const unassigned = playerData.players.filter((p) => !playersWithCampaigns.has(p.id)).length
  const issues = feedback.items.filter((f) => f.kind === 'issue').length

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
      detail: unassigned ? `${unassigned} not in a campaign` : 'All in a campaign',
      attention: unassigned > 0,
    },
    {
      id: 'feedback',
      icon: 'inbox',
      label: 'Feedback',
      value: feedback.loading ? '–' : feedback.items.length,
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
          <ManagePlayers adminPassword={adminPassword} campaigns={campaigns} {...playerData} />
        )}
        {section === 'feedback' && <FeedbackInbox {...feedback} />}
      </div>
    </div>
  )
}

const emptyPlayerForm = { username: '', password: '', campaignId: '' }

function ManagePlayers({ adminPassword, campaigns, players, memberships, loading, error, reload }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyPlayerForm)
  const [editing, setEditing] = useState(null) // { id, username, password }
  const [formError, setFormError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [saving, setSaving] = useState(false)
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
        <button type="button" className="btn btn--primary" onClick={openAdd}>
          + Add Player
        </button>
      </div>

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
                    <p className="player-card__count">
                      {playerCampaigns.length === 0
                        ? 'Not in any campaign'
                        : `${playerCampaigns.length} campaign${playerCampaigns.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </header>

                {playerCampaigns.length > 0 && (
                  <ul className="player-card__campaigns" aria-label={`${player.username}'s campaigns`}>
                    {playerCampaigns.map((m) => (
                      <li key={m.campaignId} className="player-card__campaign">
                        <span className="player-card__campaign-name">{m.campaignName}</span>
                        <span className={`player-card__role player-card__role--${m.role}`}>
                          {m.role === 'dm' ? (m.isCreator ? 'Creator · DM' : 'DM') : m.role}
                        </span>
                        <button
                          type="button"
                          className="btn btn--text player-card__dm-toggle"
                          onClick={() =>
                            run(() =>
                              setMembershipRole(
                                player.id,
                                m.campaignId,
                                m.role !== 'dm' ? 'dm' : m.isCreator ? 'creator' : 'player',
                              ),
                            )
                          }
                        >
                          {m.role === 'dm' ? 'Remove DM' : 'Make DM'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {canJoin.length > 0 && (
                  <select
                    className="player-card__add-campaign"
                    value=""
                    onChange={(e) => e.target.value && run(() => addPlayerToCampaign(player.id, e.target.value))}
                    aria-label={`Add ${player.username} to a campaign`}
                  >
                    <option value="">+ Add to a campaign…</option>
                    {canJoin.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="player-card__actions">
                  <button type="button" className="btn btn--text" onClick={() => openEdit(player)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => removePlayer(player)}>
                    Delete
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

// Genuinely anonymous — the feedback table has no player_id/campaign_id
// column at all, so there's nothing here to attribute a submission to
// even if the admin wanted to. Dismissing a submission just deletes it;
// there's no separate "reviewed" state to track.
function FeedbackInbox({ items: submissions, loading, error, removeItem }) {
  const [filter, setFilter] = useState('all')
  const [dismissError, setDismissError] = useState(null)
  const counts = {
    all: submissions.length,
    issue: submissions.filter((s) => s.kind === 'issue').length,
    suggestion: submissions.filter((s) => s.kind !== 'issue').length,
  }
  const visible = submissions.filter(
    (s) => filter === 'all' || (filter === 'issue' ? s.kind === 'issue' : s.kind !== 'issue'),
  )

  async function dismiss(item) {
    setDismissError(null)
    try {
      await removeItem(item.id)
    } catch (err) {
      setDismissError(err.message)
    }
  }

  return (
    <section className="feedback-inbox">
      {submissions.length > 0 && (
        <TabNav
          tabs={FEEDBACK_FILTERS.map((f) => ({ ...f, label: `${f.label} (${counts[f.id]})` }))}
          activeTab={filter}
          onSelect={setFilter}
          className="tab-nav--pill feedback-inbox__filter"
          label="Filter feedback"
        />
      )}

      {dismissError && <p className="empty-state empty-state--error">Couldn’t dismiss: {dismissError}</p>}
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="empty-state">
          {submissions.length === 0
            ? 'Inbox zero. Issues and suggestions players send will land here.'
            : `No ${filter === 'issue' ? 'issues' : 'suggestions'}.`}
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="feedback-inbox__list">
          {visible.map((item) => (
            <li key={item.id} className={`feedback-inbox__item panel feedback-inbox__item--${item.kind}`}>
              <div className="feedback-inbox__meta">
                <span className={`feedback-inbox__badge feedback-inbox__badge--${item.kind}`}>
                  <Icon name={item.kind === 'issue' ? 'bug' : 'lightbulb'} /> {item.kind === 'issue' ? 'Issue' : 'Suggestion'}
                </span>
                <span className="feedback-inbox__date">{formatFeedbackDate(item.createdAt)}</span>
              </div>
              <p className="feedback-inbox__message">{item.message}</p>
              <div className="feedback-inbox__actions">
                <button type="button" className="btn btn--text" onClick={() => dismiss(item)}>
                  ✓ Dismiss
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
