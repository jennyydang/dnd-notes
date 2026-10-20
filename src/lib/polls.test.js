import { describe, expect, it } from 'vitest'
import { cleanOptions, leaders, pollDecision, tallyPoll } from './polls.js'

const poll = { id: 'p', question: 'Which way?', options: ['River', 'Mountain pass', 'Forest'] }
const vote = (optionIndex, voterName, pollId = 'p') => ({ pollId, optionIndex, voterName })

describe('polls', () => {
  it('tallies votes for this poll only', () => {
    const tally = tallyPoll(poll, [vote(0, 'Ana'), vote(0, 'Bo'), vote(1, 'Cy'), vote(2, 'Di', 'other'), vote(0, 'Ed')])
    expect(tally.map((t) => t.count)).toEqual([3, 1, 0])
    expect(tally[0].share).toBe(0.75)
    expect(tally[1].voters).toEqual(['Cy'])
  })

  it('words the decision, ties and empty polls', () => {
    expect(pollDecision(poll, tallyPoll(poll, [vote(0, 'A'), vote(0, 'B'), vote(0, 'C'), vote(1, 'D')]))).toBe(
      'Party vote — “Which way?”: River (3–1).',
    )
    expect(pollDecision(poll, tallyPoll(poll, [vote(0, 'A'), vote(2, 'B')]))).toBe(
      'Party vote — “Which way?”: a tie between River and Forest (1–1).',
    )
    expect(pollDecision(poll, tallyPoll(poll, []))).toBe('Party vote — “Which way?”: no votes were cast.')
    expect(leaders(tallyPoll(poll, []))).toEqual([])
    expect(pollDecision(poll, tallyPoll(poll, [vote(1, 'A'), vote(1, 'B')]))).toBe('Party vote — “Which way?”: Mountain pass (all 2 votes).')
    expect(pollDecision(poll, tallyPoll(poll, [vote(2, 'A')]))).toBe('Party vote — “Which way?”: Forest (1 vote).')
  })

  it('cleans options', () => {
    expect(cleanOptions([' River ', '', 'river', 'Pass', 'a', 'b', 'c', 'd', 'e'])).toEqual(['River', 'Pass', 'a', 'b', 'c', 'd'])
  })
})
