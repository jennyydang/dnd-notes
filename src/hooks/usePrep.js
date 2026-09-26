import { useAutosavedDocument } from './useAutosavedDocument.js'

export const PREP_LISTS = ['objectives', 'questions', 'prepare', 'checklist']

export function emptyPrep() {
  return { nextSessionDate: '', objectives: [], questions: [], prepare: [], checklist: [] }
}

// Each list item: { id, text, done, link: { type, id } | null }.
export function normalizePrep(row) {
  const data = { ...emptyPrep(), ...(row?.data || {}) }
  for (const key of PREP_LISTS) if (!Array.isArray(data[key])) data[key] = []
  return data
}

// The logged-in player's autosaved Session Prep sheet for a campaign.
// Prep is personal, so there is none for the admin account (no player).
export function usePrep(campaignId, playerId) {
  return useAutosavedDocument({
    table: 'session_prep',
    filters: { campaign_id: campaignId, player_id: playerId },
    enabled: Boolean(playerId),
    fromRow: normalizePrep,
    toPayload: (data) => ({ data, updated_at: new Date().toISOString() }),
  })
}
