import { useEffect, useMemo, useState } from 'react'
import { useCampaignData } from '../hooks/useCampaignData.js'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { createCampaignInvite, listCampaignInvites, revokeCampaignInvite } from '../lib/auth.js'
import { listCampaignPlayers } from '../lib/campaigns.js'
import { usePlayerAvatar } from '../lib/profiles.js'
import { getPublicUrl } from '../lib/storage.js'
import { InviteDialog, InviteList } from './InvitePlayers.jsx'
import Icon from './Icon.jsx'
import './DmPlayersTab.scss'

const ROLE_LABELS = { dm: 'DM', creator: 'Creator', player: 'Player' }
const membershipFromRow = (r) => ({ id: r.id, playerId: r.player_id, role: r.role })

function CharacterChip({ member }) {
  const photo = member.photo_path ? getPublicUrl('party-portraits', member.photo_path) : ''
  const detail = [member.race_class, member.level ? `Level ${member.level}` : ''].filter(Boolean).join(' · ')
  return (
    <li className="dm-player__character">
      <span className="dm-player__character-photo" aria-hidden="true">
        {photo ? <img src={photo} alt="" /> : (member.name || '?').charAt(0).toUpperCase()}
      </span>
      <span className="dm-player__character-text">
        <span className="dm-player__character-name">{member.name}</span>
        {detail && <span className="dm-player__character-detail">{detail}</span>}
      </span>
    </li>
  )
}

function PlayerCard({ player, characters }) {
  const avatar = usePlayerAvatar(player.playerId)
  const name = player.displayName || player.username
  return (
    <li className="dm-player panel">
      <header className="dm-player__header">
        <span className="dm-player__avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : name.charAt(0).toUpperCase()}
        </span>
        <span className="dm-player__who">
          <span className="dm-player__name">{name}</span>
          {player.displayName && <span className="dm-player__username">@{player.username}</span>}
        </span>
        <span className={`dm-player__role dm-player__role--${player.role}`}>{ROLE_LABELS[player.role] || player.role}</span>
      </header>
      {characters.length > 0 ? (
        <ul className="dm-player__characters" aria-label={`${name}'s characters`}>
          {characters.map((c) => (
            <CharacterChip key={c.id} member={c} />
          ))}
        </ul>
      ) : (
        player.role !== 'dm' && <p className="dm-player__none">No character claimed yet.</p>
      )}
    </li>
  )
}

// The DM's view of who's in the campaign — each player with the
// character(s) they've claimed on the Party tab — plus sign-up invite
// links for this campaign.
function DmPlayersTab({ campaignName }) {
  const { campaignId, playerId, tables } = useCampaignData()
  // Watched so the list refreshes when someone joins or leaves.
  const memberships = useSupabaseTable('campaign_members', {
    fromRow: membershipFromRow,
    filters: { campaign_id: campaignId },
  })
  const membershipKey = memberships.items.map((m) => `${m.playerId}:${m.role}`).sort().join(',')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [invitesChanged, setInvitesChanged] = useState(0)

  useEffect(() => {
    let cancelled = false
    listCampaignPlayers(campaignId)
      .then((list) => !cancelled && (setPlayers(list), setError(null)))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaignId, membershipKey])

  const party = tables.character.items
  const byPlayer = useMemo(() => {
    const map = new Map()
    for (const m of party) if (m.claimed_by) map.set(m.claimed_by, [...(map.get(m.claimed_by) || []), m])
    return map
  }, [party])
  const memberIds = new Set(players.map((p) => p.playerId))
  const unclaimed = party.filter((m) => m.member_type !== 'NPC' && (!m.claimed_by || !memberIds.has(m.claimed_by)))
  const playerCount = players.filter((p) => p.role === 'player').length

  return (
    <section className="dm-players">
      <div className="dm-players__toolbar">
        <p className="dm-players__summary">
          {loading ? 'Loading…' : `${playerCount} player${playerCount === 1 ? '' : 's'} in ${campaignName}`}
        </p>
        {playerId && (
          <button type="button" className="btn btn--primary" onClick={() => setInviting(true)}>
            <Icon name="send" /> Invite players
          </button>
        )}
      </div>

      {inviting && (
        <InviteDialog
          create={({ note }) => createCampaignInvite(playerId, campaignId, note)}
          fixedCampaign={{ id: campaignId, name: campaignName }}
          onClose={() => setInviting(false)}
          onCreated={() => setInvitesChanged((n) => n + 1)}
        />
      )}
      {playerId && (
        <InviteList
          load={() => listCampaignInvites(playerId, campaignId)}
          revoke={(id) => revokeCampaignInvite(playerId, id)}
          // A sign-up from one of these links adds a member, so refresh then too.
          refreshKey={`${invitesChanged}|${membershipKey}`}
          showCampaign={false}
        />
      )}

      {error && <p className="empty-state empty-state--error">{error}</p>}
      {!loading && !error && players.length === 0 && (
        <p className="empty-state">No one has joined yet. Invite players with a sign-up link.</p>
      )}
      {players.length > 0 && (
        <ul className="dm-players__list">
          {players.map((p) => (
            <PlayerCard key={p.playerId} player={p} characters={byPlayer.get(p.playerId) || []} />
          ))}
        </ul>
      )}

      {unclaimed.length > 0 && (
        <section className="dm-players__unclaimed" aria-labelledby="dm-unclaimed-title">
          <h3 id="dm-unclaimed-title" className="dm-players__subtitle">
            Characters nobody has claimed
          </h3>
          <ul className="dm-player__characters">
            {unclaimed.map((c) => (
              <CharacterChip key={c.id} member={c} />
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

export default DmPlayersTab
