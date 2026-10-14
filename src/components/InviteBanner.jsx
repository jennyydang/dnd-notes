import { useEffect, useState } from 'react'
import { acceptInvite, checkInvite, clearInviteFromUrl, inviteFromUrl } from '../lib/auth.js'
import Icon from './Icon.jsx'
import './InviteBanner.scss'

const PROBLEMS = {
  used: 'This invite link has already been used.',
  expired: 'This invite link has expired.',
  revoked: 'This invite link was cancelled.',
  invalid: 'This invite link isn’t valid.',
}

// A logged-in player who opens a campaign's invite link (…/?invite=TOKEN)
// gets offered that campaign here. Players can be in any number of
// campaigns; joining opens it straight away.
function InviteBanner({ playerId, onJoined }) {
  const [token] = useState(inviteFromUrl)
  const [invite, setInvite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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

  if (!token || !invite) return null

  function dismiss() {
    clearInviteFromUrl()
    setInvite(null)
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const { campaignId, campaignName } = await acceptInvite(playerId, token)
      clearInviteFromUrl()
      setInvite(null)
      onJoined({ id: campaignId, name: campaignName })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  let message
  let canJoin = false
  if (invite.status === 'ok' && invite.campaignName) {
    message = (
      <>
        You’re invited to join <strong>{invite.campaignName}</strong>.
      </>
    )
    canJoin = true
  } else if (invite.status === 'ok') {
    message = 'That invite link is for making a new account — you already have one. To join a campaign, use + Campaign with the join code from your DM.'
  } else {
    message = `${invite.status === 'error' ? invite.message : PROBLEMS[invite.status] || PROBLEMS.invalid} Ask whoever invited you for a new link.`
  }

  return (
    <div className={`invite-banner panel${canJoin ? '' : ' invite-banner--problem'}`} role={canJoin ? 'status' : 'alert'}>
      <Icon name={canJoin ? 'send' : 'alert'} className="invite-banner__icon" />
      <div className="invite-banner__body">
        <p className="invite-banner__text">{message}</p>
        {error && <p className="invite-banner__error">{error}</p>}
      </div>
      <div className="invite-banner__actions">
        {canJoin && (
          <button type="button" className="btn btn--primary" onClick={join} disabled={busy}>
            {busy ? 'Joining…' : 'Join campaign'}
          </button>
        )}
        <button type="button" className="btn btn--text" onClick={dismiss} disabled={busy}>
          {canJoin ? 'Not now' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}

export default InviteBanner
