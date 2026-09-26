import { useCallback } from 'react'
import { useAutosavedDocument } from './useAutosavedDocument.js'
import { normalizeSheet } from '../lib/character.js'

// The autosaved character sheet ({ mechanics, narrative }) of one party
// member. Mount under key={partyMemberId}.
export function useCharacterSheet(campaignId, partyMemberId) {
  const { doc, update, ...rest } = useAutosavedDocument({
    table: 'character_sheets',
    filters: { campaign_id: campaignId, party_member_id: partyMemberId },
    enabled: Boolean(partyMemberId),
    fromRow: normalizeSheet,
    toPayload: (sheet) => ({
      mechanics: sheet.mechanics,
      narrative: sheet.narrative,
      updated_at: new Date().toISOString(),
    }),
  })

  const updateMechanics = useCallback(
    (patch) =>
      update((s) => ({
        ...s,
        mechanics: { ...s.mechanics, ...(typeof patch === 'function' ? patch(s.mechanics) : patch) },
      })),
    [update],
  )
  const updateNarrative = useCallback(
    (patch) =>
      update((s) => ({
        ...s,
        narrative: { ...s.narrative, ...(typeof patch === 'function' ? patch(s.narrative) : patch) },
      })),
    [update],
  )

  return { sheet: doc, update, updateMechanics, updateNarrative, ...rest }
}
