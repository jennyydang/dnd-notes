import { useMemo } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { useSupabaseTable } from '../../hooks/useSupabaseTable.js'
import { normalizeSheet } from '../../lib/character.js'
import './DownedPulse.scss'

const NEVER_MATCHES = '00000000-0000-0000-0000-000000000000'

// While the player's own character is at 0 HP and still making death
// saves, the screen edges pulse red like a heartbeat, on every tab. It
// stops when they're healed, stabilised (three successes) or dead.
function DownedPulse() {
  const { campaignId, playerId, tables } = useCampaignData()
  const mine = tables.character.items.find((m) => playerId && m.claimed_by === playerId)
  const { items } = useSupabaseTable('character_sheets', {
    filters: { campaign_id: campaignId, party_member_id: mine?.id || NEVER_MATCHES },
  })
  const sheet = useMemo(() => (items[0] ? normalizeSheet(items[0]) : null), [items])

  const hp = sheet?.mechanics.hp
  const saves = sheet?.mechanics.deathSaves || { success: 0, failure: 0 }
  const down =
    hp && hp.max !== null && hp.max !== '' && hp.current !== null && hp.current !== '' && Number(hp.current) <= 0
  if (!down || saves.success >= 3 || saves.failure >= 3) return null

  return (
    <div className="downed-pulse">
      <div className="downed-pulse__edge" aria-hidden="true" />
      <p className="downed-pulse__label" role="status">
        <span className="downed-pulse__heart" aria-hidden="true">
          ♥
        </span>{' '}
        {mine.name || 'You'} {mine.name ? 'is' : 'are'} down — death saves {saves.success}✓ {saves.failure}✗
      </p>
    </div>
  )
}

export default DownedPulse
