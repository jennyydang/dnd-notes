import { describe, expect, it } from 'vitest'
import { buildPreviously, recapExcerpt } from '../previously.js'

const npc = (id, title, updatedAt) => ({ id, type: 'npc', title, updatedAt, raw: {} })

describe('recapExcerpt', () => {
  it('keeps whole lines and drops blanks', () => {
    expect(recapExcerpt('We met Ismark.\n\n  The church bell rang.  ')).toEqual(['We met Ismark.', 'The church bell rang.'])
  })

  it('drops tag symbols from mentions but keeps other text', () => {
    expect(recapExcerpt('We met @Ismark in #Barovia, found $Sunsword. Cost: $5 #1 fan')).toEqual([
      'We met Ismark in Barovia, found Sunsword. Cost: $5 #1 fan',
    ])
    expect(recapExcerpt('email a@b.com stays')).toEqual(['email a@b.com stays'])
  })

  it('stops at the limit, trimming a single long line', () => {
    const long = recapExcerpt('x'.repeat(900))
    expect(long).toHaveLength(1)
    expect(long[0].length).toBeLessThanOrEqual(700)
    expect(long[0].endsWith('…')).toBe(true)
    expect(recapExcerpt(`${'a'.repeat(400)}\n${'b'.repeat(400)}`)).toEqual(['a'.repeat(400), '…'])
  })
})

describe('buildPreviously', () => {
  const npcs = [npc('1', 'Ismark', '2026-10-01'), npc('2', 'Ireena', '2026-10-09'), npc('3', 'Doru', '2026-09-01')]

  it('prefers NPCs tagged in the last recap', () => {
    const card = buildPreviously({
      sessions: [{ id: 's2' }, { id: 's1' }],
      recapText: 'Ireena joined us.',
      mentions: { person: [{ id: '2', label: 'Ireena' }, { id: '9', label: 'Strahd' }], place: [{ label: 'Barovia' }] },
      npcs,
      threads: [{ id: 'q' }],
    })
    expect(card.number).toBe(2)
    expect(card.recap).toEqual(['Ireena joined us.'])
    expect(card.facesAreTagged).toBe(true)
    expect(card.faces.map((f) => f.title)).toEqual(['Ireena', 'Strahd'])
    expect(card.places).toEqual(['Barovia'])
  })

  it('falls back to recently updated NPCs, and copes with no sessions', () => {
    const card = buildPreviously({ sessions: [], recapText: '', mentions: null, npcs, threads: [] })
    expect(card.last).toBeNull()
    expect(card.recap).toEqual([])
    expect(card.facesAreTagged).toBe(false)
    expect(card.faces.map((f) => f.title)).toEqual(['Ireena', 'Ismark', 'Doru'])
  })
})
