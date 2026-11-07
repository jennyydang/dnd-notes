import { describe, expect, it } from 'vitest'
import { QUICK_TYPES, payloadFor } from '../quickTypes.js'

describe('quick add: party member', () => {
  it('is a quick type that makes a character', () => {
    expect(QUICK_TYPES.party).toMatchObject({ entity: 'character', kinds: ['Player', 'NPC'] })
  })
  it('saves name, who plays them, race & class and notes', () => {
    expect(payloadFor('party', { name: 'Thessaly', kind: 'NPC', extra: 'Half-elf Ranger', notes: 'Hired guide' })).toEqual({
      name: 'Thessaly',
      member_type: 'NPC',
      race_class: 'Half-elf Ranger',
      notes: 'Hired guide',
    })
  })
  it('defaults to a player character', () => {
    expect(payloadFor('party', { name: 'Bram', kind: '', extra: '', notes: '' }).member_type).toBe('Player')
  })
})
