import { describe, expect, it } from 'vitest'
import { clueStatus, groupClues, isClue, quietSince, rankTheories, sessionLabel } from './mysteries.js'

describe('mysteries', () => {
  it('knows a clue by its category', () => {
    expect(isClue({ category: ' clue ' })).toBe(true)
    expect(isClue({ category: 'History' })).toBe(false)
    expect(isClue({})).toBe(false)
  })

  it('labels the running session', () => {
    expect(sessionLabel(13, { startedAt: 'x' })).toBe('Session 14')
    expect(sessionLabel(13, null)).toBe('')
  })

  it('falls back to Lead for an unknown status, and groups by status', () => {
    expect(clueStatus('nope').id).toBe('lead')
    const groups = groupClues([{ id: 1, clueStatus: 'confirmed' }, { id: 2 }, { id: 3, clueStatus: 'herring' }])
    expect(groups.map((g) => g.clues.map((c) => c.id))).toEqual([[2], [1], [3]])
  })

  it('ranks theories by votes, oldest first on a tie', () => {
    const theories = [
      { id: 'a', createdAt: '2026-01-02' },
      { id: 'b', createdAt: '2026-01-03' },
      { id: 'c', createdAt: '2026-01-01' },
    ]
    const votes = [
      { theoryId: 'b', playerId: 'p1' },
      { theoryId: 'b', playerId: 'p2' },
      { theoryId: 'a', playerId: 'p1' },
    ]
    const ranked = rankTheories(theories, votes, 'p2')
    expect(ranked.map((t) => [t.id, t.votes, t.voted])).toEqual([
      ['b', 2, true],
      ['a', 1, false],
      ['c', 0, false],
    ])
  })

  it('flags a mystery that has gone quiet', () => {
    const now = new Date('2026-10-18').getTime()
    const m = { createdAt: '2026-08-01' }
    expect(quietSince(m, [{ createdAt: '2026-09-01' }], [], now)).toBeTruthy()
    expect(quietSince(m, [{ createdAt: '2026-10-10' }], [], now)).toBeNull()
  })
})
