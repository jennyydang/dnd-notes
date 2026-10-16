// How an NPC feels about the party, worst to best, and its history.

export const ATTITUDES = [
  { id: 'Hostile', color: '#d0605c', hint: 'Out to get us' },
  { id: 'Wary', color: '#d6a04e', hint: 'Doesn’t trust us' },
  { id: 'Neutral', color: '#a9a49a', hint: 'No strong feelings' },
  { id: 'Friendly', color: '#7fbf8e', hint: 'Likes us' },
  { id: 'Ally', color: '#5fb3d6', hint: 'Will stand with us' },
]

export const attitudeInfo = (id) => ATTITUDES.find((a) => a.id === id) || null

// The patch that moves an NPC to a new attitude, logging why.
export function attitudeChange(npc, to, note = '', now = new Date()) {
  const log = Array.isArray(npc.attitudeLog) ? npc.attitudeLog : []
  const from = npc.attitude || null
  if (from === to) return null
  return {
    attitude: to,
    attitude_log: [...log, { from, to, note: note.trim(), at: now.toISOString() }],
  }
}

// "Wary → Hostile" / "→ Friendly" (first judged).
export const changeLabel = (entry) => (entry.from ? `${entry.from} → ${entry.to}` : `→ ${entry.to}`)

// Did they warm to the party or cool on it?
export function direction(entry) {
  const i = (id) => ATTITUDES.findIndex((a) => a.id === id)
  if (!entry.from) return 'set'
  return i(entry.to) > i(entry.from) ? 'up' : 'down'
}
