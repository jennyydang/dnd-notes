import { recapParagraphs } from './relationshipWeb.js'
import { groupForChar } from './tags.js'

// A session's highlight reel: its moments in order —
//  1. the story: everyone and everything tagged in the recap, in the order
//     they come up, each with the sentence it came up in;
//  2. the recording's bookmarks;
//  3. what was decided and finished that day: party votes, quests.

const VERBS = {
  person: 'Met',
  place: 'Went to',
  lore: 'Learned of',
  loot: 'Found',
  creature: 'Faced',
  event: 'Moment',
}

const sameDay = (iso, date) => {
  if (!iso || !date) return false
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  return local === date
}

const clip = (text, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export function buildReel({ notes, sessionDate, marks = [], polls = [], quests = [] }) {
  const moments = []
  const seen = new Set()
  for (const p of recapParagraphs(notes)) {
    for (const tag of p.tags) {
      const group = groupForChar(tag.char)
      const key = `${group}:${tag.id}`
      if (seen.has(key)) continue
      seen.add(key)
      moments.push({
        key,
        kind: group,
        verb: VERBS[group] || 'Tagged',
        label: tag.label,
        id: tag.id,
        context: group === 'event' ? '' : clip(p.text),
      })
    }
  }
  for (const m of [...marks].sort((a, b) => a.t - b.t)) {
    moments.push({ key: `mark:${m.t}`, kind: 'mark', verb: 'Bookmarked', label: m.label, t: m.t })
  }
  for (const poll of polls) {
    if (poll.status === 'closed' && poll.result && sameDay(poll.closedAt, sessionDate)) {
      moments.push({ key: `vote:${poll.id}`, kind: 'vote', verb: 'Party voted', label: poll.result.replace(/^Party vote — /, '') })
    }
  }
  for (const q of quests) {
    const done = q.status === 'Completed' || q.status === 'Failed'
    if (done && sameDay(q.updated_at || q.updatedAt, sessionDate)) {
      moments.push({ key: `quest:${q.id}`, kind: 'quest', verb: q.status === 'Failed' ? 'Quest failed' : 'Quest completed', label: q.name, id: q.id })
    }
  }
  return moments
}
