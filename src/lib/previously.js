import { sessionDateTimestamp } from './sessionNotes.js'

// Picks what goes on the "Previously on…" card. Pure: the caller passes
// the recap as plain text and its @/# tags (see lib/richNotes.js).

const MAX_RECAP_CHARS = 700
const MAX_FACES = 5
const MAX_THREADS = 5

// Tags in a recap read as "@Ismark" / "#Barovia" in plain text; on the
// card (and read aloud) they should just be names.
const TAG_PREFIX = /(^|[\s(“"'])[@#~$!](?=\p{L})/gu

// The opening of the recap, whole lines only where possible.
export function recapExcerpt(text) {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.replace(TAG_PREFIX, '$1').trim())
    .filter(Boolean)
  const kept = []
  let length = 0
  for (const line of lines) {
    if (length + line.length > MAX_RECAP_CHARS) {
      if (!kept.length) kept.push(`${line.slice(0, MAX_RECAP_CHARS - 1).trimEnd()}…`)
      else kept.push('…')
      break
    }
    kept.push(line)
    length += line.length
  }
  return kept
}

// `sessions` newest first; `npcs` and `threads` are normalized entities.
export function buildPreviously({ sessions, recapText, mentions, npcs, threads }) {
  const last = sessions[0] || null
  const tagged = (mentions?.person || [])
    .map((m) => npcs.find((n) => n.id === m.id) || { id: m.id, title: m.label, raw: {} })
    .slice(0, MAX_FACES)
  const recent = [...npcs]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, MAX_FACES)
  return {
    last,
    number: sessions.length,
    recap: last ? recapExcerpt(recapText) : [],
    faces: tagged.length ? tagged : recent,
    facesAreTagged: tagged.length > 0,
    places: (mentions?.place || []).map((p) => p.label).slice(0, MAX_FACES),
    threads: threads.slice(0, MAX_THREADS),
  }
}

// Session entities, latest session date first (then newest created).
export function sortedSessions(entities) {
  return entities
    .filter((e) => e.type === 'session')
    .sort(
      (a, b) =>
        sessionDateTimestamp(b.raw.session_date) - sessionDateTimestamp(a.raw.session_date) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )
}
