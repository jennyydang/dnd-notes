import { useState } from 'react'
import { useCampaignData } from './useCampaignData.js'
import { getStored, setStored } from '../lib/sessionMode.js'

// The character this screen is about. A player's is the party member they
// claimed on the Party tab. The admin account has no character of its
// own, so it picks any party member (remembered per campaign).
export function useActiveCharacter() {
  const { campaignId, playerId, tables } = useCampaignData()
  const party = tables.character.items
  const storageKey = `dnd-notes-admin-character:${campaignId}`
  const [adminPick, setAdminPick] = useState(() => getStored(storageKey, null))

  const claimed = playerId ? party.find((m) => m.claimed_by === playerId) || null : null
  const picked = !playerId ? party.find((m) => m.id === adminPick) || null : null

  return {
    character: playerId ? claimed : picked,
    party,
    loading: tables.character.loading,
    error: tables.character.error,
    isAdmin: !playerId,
    pick: (id) => {
      setAdminPick(id)
      setStored(storageKey, id)
    },
  }
}
