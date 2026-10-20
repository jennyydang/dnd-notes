// Party polls: counting votes and wording the decision.

export const MAX_POLL_OPTIONS = 6

// Votes per option, in the poll's order: [{ index, label, count, voters, share }].
export function tallyPoll(poll, votes) {
  const mine = votes.filter((v) => v.pollId === poll.id)
  const total = mine.length
  return poll.options.map((label, index) => {
    const voters = mine.filter((v) => v.optionIndex === index).map((v) => v.voterName || 'Someone')
    return { index, label, count: voters.length, voters, share: total ? voters.length / total : 0 }
  })
}

// The options with the most votes (more than one on a tie; none if no one voted).
export function leaders(tally) {
  const top = Math.max(0, ...tally.map((t) => t.count))
  return top ? tally.filter((t) => t.count === top) : []
}

// "Party voted: Take the river (3–1)" — the line saved into everyone's notes.
export function pollDecision(poll, tally) {
  const won = leaders(tally)
  const counts = tally
    .map((t) => t.count)
    .filter(Boolean)
    .sort((a, b) => b - a)
    .join('–')
  if (!won.length) return `Party vote — “${poll.question}”: no votes were cast.`
  if (won.length > 1) {
    return `Party vote — “${poll.question}”: a tie between ${won.map((t) => t.label).join(' and ')} (${counts}).`
  }
  const total = tally.reduce((sum, t) => sum + t.count, 0)
  if (won[0].count === total) {
    return `Party vote — “${poll.question}”: ${won[0].label} (${total === 1 ? '1 vote' : `all ${total} votes`}).`
  }
  return `Party vote — “${poll.question}”: ${won[0].label} (${counts}).`
}

// Cleans a new poll's options: trimmed, no blanks or repeats, at most six.
export function cleanOptions(options) {
  const seen = new Set()
  return options
    .map((o) => o.trim())
    .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()))
    .slice(0, MAX_POLL_OPTIONS)
}
