// The Lore & Clues board: what a clue is, its statuses, which session
// it turned up in, and how a mystery's theories rank.

export const CLUE_STATUSES = [
  { id: 'lead', label: 'Lead' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'herring', label: 'Red herring' },
]

export const clueStatus = (id) => CLUE_STATUSES.find((s) => s.id === id) || CLUE_STATUSES[0]

// Clues are lore entries with category "Clue" (see TAG_GROUPS.lore).
export const isClue = (entry) => /^clue$/i.test(String(entry?.category ?? '').trim())

// "Session 14" while a session is running: one more than the recaps this
// player has written so far. Outside a session there's no label, and the
// clue's date stands in.
export function sessionLabel(recapCount, active) {
  return active ? `Session ${recapCount + 1}` : ''
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export function foundLabel(item) {
  if (item.foundIn) return item.foundIn
  return item.createdAt ? dateFormat.format(new Date(item.createdAt)) : ''
}

// Theories with their votes, most-voted first (older first on a tie), and
// whether this player has voted for each.
export function rankTheories(theories, votes, playerId) {
  return theories
    .map((t) => {
      const mine = votes.filter((v) => v.theoryId === t.id)
      return { ...t, votes: mine.length, voted: Boolean(playerId) && mine.some((v) => v.playerId === playerId) }
    })
    .sort((a, b) => b.votes - a.votes || String(a.createdAt).localeCompare(String(b.createdAt)))
}

// Clues grouped the way a mystery shows them.
export function groupClues(clues) {
  return CLUE_STATUSES.map((s) => ({ ...s, clues: clues.filter((c) => clueStatus(c.clueStatus).id === s.id) }))
}

const QUIET_DAYS = 28
const DAY = 24 * 60 * 60 * 1000

// An open mystery nobody has added to in a while: the date of its latest
// clue or theory (or its own start), when that's more than four weeks ago.
export function quietSince(mystery, clues, theories, now = Date.now()) {
  const dates = [mystery, ...clues, ...theories].map((x) => new Date(x.createdAt).getTime()).filter(Number.isFinite)
  if (dates.length === 0) return null
  const latest = Math.max(...dates)
  return now - latest > QUIET_DAYS * DAY ? dateFormat.format(new Date(latest)) : null
}
