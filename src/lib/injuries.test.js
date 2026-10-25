import { describe, expect, it } from 'vitest'
import { healInjuries, partyHealth } from './injuries.js'

const hurt = [
  { region: 'head', pain: 1 },
  { region: 'chest', pain: 2 },
  { region: 'left-leg', pain: 5, note: 'Troll bite' },
]

describe('healInjuries', () => {
  it('a short rest eases every injury by one and heals the sore ones', () => {
    expect(healInjuries(hurt, 'short')).toEqual([
      { region: 'chest', pain: 1 },
      { region: 'left-leg', pain: 4, note: 'Troll bite' },
    ])
  })
  it('a long rest eases them by two', () => {
    expect(healInjuries(hurt, 'long')).toEqual([{ region: 'left-leg', pain: 3, note: 'Troll bite' }])
  })
  it('copes with a sheet that has no injuries', () => {
    expect(healInjuries(undefined, 'long')).toEqual([])
  })
})

describe('partyHealth', () => {
  const party = [
    { id: 'a', name: 'Aria' },
    { id: 'b', name: 'Bram' },
    { id: 'n', name: 'Hired guard', member_type: 'NPC' },
  ]
  const sheets = [
    { party_member_id: 'a', mechanics: { hp: { current: 20, max: 20 }, injuries: [] } },
    { party_member_id: 'b', mechanics: { hp: { current: 4, max: 30 }, injuries: hurt } },
  ]
  it('lists player characters, most hurt first, worst injury first', () => {
    const health = partyHealth(party, sheets)
    expect(health.map((h) => h.member.name)).toEqual(['Bram', 'Aria'])
    expect(health[0].worst).toBe(5)
    expect(health[0].injuries[0].region).toBe('left-leg')
    expect(health[1].hp).toEqual({ current: 20, max: 20 })
  })
  it('handles characters with no sheet yet', () => {
    expect(partyHealth([{ id: 'x', name: 'New' }], [])[0]).toMatchObject({ injuries: [], worst: 0, hp: null })
  })
})
