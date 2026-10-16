import { describe, expect, it } from 'vitest'
import { buildReel } from './highlights.js'
import { attitudeChange, direction } from './attitude.js'

const tag = (c, id, label) =>
  `<span data-type="mention" data-id="${id}" data-label="${label}" data-mention-suggestion-char="${c}">${label}</span>`

describe('highlight reel', () => {
  it('orders the story, then bookmarks, votes and quests of the day', () => {
    const notes = `<p>At ${tag('#', 'p1', 'Saltmere')} we met ${tag('@', 'n1', 'Old Marta')}.</p><p>${tag('%', 'c1', 'Kraken')} attacked! ${tag('@', 'n1', 'Old Marta')} fled.</p><p>${tag('!', 'e1', 'The lighthouse fell')}</p>`
    const reel = buildReel({
      notes,
      sessionDate: '2026-09-25',
      marks: [{ t: 300, label: 'Fight' }, { t: 60, label: 'Intro' }],
      polls: [
        { id: 'v1', status: 'closed', result: 'Party vote — “Rest?”: No (3–1).', closedAt: '2026-09-25T20:00:00' },
        { id: 'v2', status: 'closed', result: 'Party vote — “Old?”: Yes.', closedAt: '2026-09-01T20:00:00' },
      ],
      quests: [{ id: 'q1', name: 'Light it', status: 'Completed', updated_at: '2026-09-25T21:00:00' }],
    })
    expect(reel.map((m) => `${m.verb} ${m.label}`)).toEqual([
      'Went to Saltmere',
      'Met Old Marta',
      'Faced Kraken',
      'Moment The lighthouse fell',
      'Bookmarked Intro',
      'Bookmarked Fight',
      'Party voted “Rest?”: No (3–1).',
      'Quest completed Light it',
    ])
    expect(reel[1].context).toBe('At Saltmere we met Old Marta.')
  })
})

describe('attitude', () => {
  it('logs changes', () => {
    const patch = attitudeChange({ attitude: 'Wary', attitudeLog: [] }, 'Hostile', ' Betrayed us ', new Date('2026-10-01T00:00:00Z'))
    expect(patch).toEqual({ attitude: 'Hostile', attitude_log: [{ from: 'Wary', to: 'Hostile', note: 'Betrayed us', at: '2026-10-01T00:00:00.000Z' }] })
    expect(direction(patch.attitude_log[0])).toBe('down')
    expect(attitudeChange({ attitude: 'Ally' }, 'Ally')).toBe(null)
  })
})
