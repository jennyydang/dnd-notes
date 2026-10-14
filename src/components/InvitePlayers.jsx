import { useCallback, useEffect, useRef, useState } from 'react'
import { inviteLink } from '../lib/auth.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './InvitePlayers.scss'

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function inviteStatus(invite, now) {
  if (invite.used_at) return { id: 'used', label: `Used by ${invite.used_by_username || 'a deleted player'}` }
  if (invite.revoked_at) return { id: 'revoked', label: 'Cancelled' }
  if (new Date(invite.expires_at).getTime() < now) return { id: 'expired', label: 'Expired' }
  return { id: 'waiting', label: `Waiting · expires ${formatDate(invite.expires_at)}` }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// The finished link, ready to copy or send.
export function LinkBox({
  link,
  onCopied,
  id = 'invite-link-url',
  label = 'Invite link',
  shareTitle = 'Join Adventurer’s Log',
  shareText = 'Your invite to Adventurer’s Log',
}) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share)
  return (
    <div className="invite-link">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="invite-link__url" value={link} readOnly onFocus={(e) => e.target.select()} />
      <div className="invite-link__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            if (await copyText(link)) {
              setCopied(true)
              onCopied?.()
            }
          }}
        >
          <Icon name="clipboard" /> {copied ? 'Copied!' : 'Copy link'}
        </button>
        {canShare && (
          <button
            type="button"
            className="btn"
            onClick={() => navigator.share({ title: shareTitle, text: shareText, url: link }).catch(() => {})}
          >
            <Icon name="send" /> Share
          </button>
        )}
      </div>
    </div>
  )
}

// Invite a player by sign-up link. The admin picks a campaign (or none);
// a DM's invite is always for their campaign (`fixedCampaign`).
// `create({ campaignId, note })` makes the invite and resolves to it.
export function InviteDialog({ create, campaigns = [], fixedCampaign = null, onClose, onCreated }) {
  const [campaignId, setCampaignId] = useState('')
  const [note, setNote] = useState('')
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const active = campaigns.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name))
  const chosen = fixedCampaign || active.find((c) => c.id === campaignId)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const invite = await create({ campaignId: fixedCampaign ? fixedCampaign.id : campaignId || null, note })
      setLink(inviteLink(invite.token))
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} label="Invite a player" size="narrow">
      {link ? (
        <div className="invite-dialog">
          <h3 className="section-card__title">Invite link ready</h3>
          <p className="invite-dialog__lead">
            Send this to {note.trim() || 'the new player'}. It works once and expires in 30 days.
            {chosen ? ` They’ll join ${chosen.name} when they sign up.` : ' They can join a campaign later with its join code.'}
          </p>
          <LinkBox link={link} />
          <div className="form-actions">
            <button type="button" className="btn btn--text" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="invite-dialog" onSubmit={submit}>
          <h3 className="section-card__title">Invite a player</h3>
          <p className="invite-dialog__lead">
            {fixedCampaign
              ? `Creates a sign-up link only they can use. They’ll join ${fixedCampaign.name} when they sign up.`
              : 'Creates a sign-up link only they can use. Accounts can’t be made without one.'}
          </p>
          {!fixedCampaign && (
            <div className="field">
              <label htmlFor="invite-campaign">Campaign</label>
              <select id="invite-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">No campaign — they’ll join one later with a code</option>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="invite-note">Who’s it for? (optional)</label>
            <input
              id="invite-note"
              type="text"
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sam, Thaelan’s player"
            />
          </div>
          {error && (
            <p className="invite-dialog__error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn--text" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create invite link'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// A list of invite links: copy a waiting one again, or cancel it.
// `load()` resolves to the invites; `revoke(id)` cancels one.
export function InviteList({ load: fetchInvites, revoke: cancelInvite, refreshKey, onChanged, showCampaign = true }) {
  const [invites, setInvites] = useState([])
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [now] = useState(() => Date.now())

  const fetchRef = useRef(fetchInvites)
  fetchRef.current = fetchInvites
  const load = useCallback(async () => {
    try {
      setInvites(await fetchRef.current())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function revoke(invite) {
    if (!window.confirm(`Cancel this invite${invite.note ? ` for ${invite.note}` : ''}? The link will stop working.`)) return
    try {
      await cancelInvite(invite.id)
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const withStatus = invites.map((i) => ({ ...i, status: inviteStatus(i, now) }))
  const waiting = withStatus.filter((i) => i.status.id === 'waiting')
  const shown = showAll ? withStatus : waiting
  if (!error && invites.length === 0) return null

  return (
    <section className="invite-list" aria-labelledby="invite-list-title">
      <div className="invite-list__head">
        <h3 id="invite-list-title" className="invite-list__title">
          Invite links {waiting.length > 0 && <span className="invite-list__count">{waiting.length} waiting</span>}
        </h3>
        {withStatus.length > waiting.length && (
          <button type="button" className="btn btn--text" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Only waiting' : `Show all (${withStatus.length})`}
          </button>
        )}
      </div>
      {error && <p className="invite-dialog__error">{error}</p>}
      {shown.length === 0 && !error && <p className="invite-list__empty">No invites waiting.</p>}
      <ul className="invite-list__items">
        {shown.map((invite) => (
          <li key={invite.id} className={`invite-list__item invite-list__item--${invite.status.id}`}>
            <div className="invite-list__who">
              <span className="invite-list__note">{invite.note || 'Invite'}</span>
              <span className="invite-list__meta">
                {showCampaign && `${invite.campaign_name ? `Joins ${invite.campaign_name}` : 'No campaign'} · `}
                {invite.status.label}
              </span>
            </div>
            {invite.status.id === 'waiting' && (
              <div className="invite-list__actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={async () => {
                    if (await copyText(inviteLink(invite.token))) setCopiedId(invite.id)
                  }}
                >
                  {copiedId === invite.id ? 'Copied!' : 'Copy link'}
                </button>
                <button type="button" className="btn btn--text" onClick={() => revoke(invite)}>
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
