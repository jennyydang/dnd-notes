import { useMemo } from 'react'
import { useCampaignData } from './useCampaignData.js'
import { useSupabaseTable } from './useSupabaseTable.js'
import { partyHealth } from '../lib/injuries.js'

const identity = (row) => row

// Every player character's HP and injuries, kept live from their sheets
// (see lib/injuries.js partyHealth).
export function usePartyHealth() {
  const { campaignId, tables } = useCampaignData()
  const sheets = useSupabaseTable('character_sheets', { fromRow: identity, filters: { campaign_id: campaignId } })
  const party = tables.character.items
  const health = useMemo(() => partyHealth(party, sheets.items), [party, sheets.items])
  return { health, loading: sheets.loading || tables.character.loading }
}
