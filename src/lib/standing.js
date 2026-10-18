// The party's reputation with a faction (a Lore entry whose category is
// "Faction"): a track from −3 to +3, and the history of how it moved.

export const STANDINGS = [
  { value: -3, id: 'Hated', color: '#c8504c', hint: 'Wants the party gone' },
  { value: -2, id: 'Hostile', color: '#d0705c', hint: 'Works against us' },
  { value: -1, id: 'Unfriendly', color: '#d6a04e', hint: 'Cold, unhelpful' },
  { value: 0, id: 'Neutral', color: '#a9a49a', hint: 'Doesn’t care either way' },
  { value: 1, id: 'Friendly', color: '#9cc77e', hint: 'Open to us' },
  { value: 2, id: 'Trusted', color: '#6fbf9a', hint: 'Will do us favours' },
  { value: 3, id: 'Revered', color: '#5fb3d6', hint: 'Counts us as their own' },
]

export const standingInfo = (value) =>
  value === null || value === undefined ? null : STANDINGS.find((s) => s.value === Number(value)) || null

export const isFaction = (entry) => /^\s*factions?\s*$/i.test(entry?.category || '')

// The patch that moves a faction to a new standing, logging why.
export function standingChange(entry, to, note = '', now = new Date()) {
  const log = Array.isArray(entry.standingLog) ? entry.standingLog : []
  const from = entry.standing ?? null
  if (from === to) return null
  return {
    standing: to,
    standing_log: [...log, { from, to, note: note.trim(), at: now.toISOString() }],
  }
}

// "Neutral → Friendly" / "→ Trusted" (first set).
export function standingChangeLabel(entry) {
  const name = (v) => standingInfo(v)?.id || '?'
  return entry.from === null || entry.from === undefined ? `→ ${name(entry.to)}` : `${name(entry.from)} → ${name(entry.to)}`
}

export function standingDirection(entry) {
  if (entry.from === null || entry.from === undefined) return 'set'
  return entry.to > entry.from ? 'up' : 'down'
}
