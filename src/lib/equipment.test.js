import { describe, expect, it } from 'vitest'
import { equipChanges, freeSlotFor, guessSlotKind, layoutEquipment } from './equipment.js'

describe('slots', () => {
  it('guesses where gear is worn', () => {
    expect(guessSlotKind({ item: 'Helm of Brilliance' })).toBe('head')
    expect(guessSlotKind({ item: 'Amulet of Health' })).toBe('neck')
    expect(guessSlotKind({ item: 'Cloak of Elvenkind' })).toBe('back')
    expect(guessSlotKind({ item: 'Studded leather armor' })).toBe('body')
    expect(guessSlotKind({ item: 'Gauntlets of Ogre Power' })).toBe('hands')
    expect(guessSlotKind({ item: 'Boots of Speed' })).toBe('feet')
    expect(guessSlotKind({ item: 'Ring of Protection' })).toBe('ring')
    expect(guessSlotKind({ item: 'Shield +1' })).toBe('off')
    expect(guessSlotKind({ item: 'Longsword +1' })).toBe('main')
  })
  it('fills the free ring slot first', () => {
    expect(freeSlotFor({ item: 'Ring of Warmth' }, {})).toBe('ring1')
    expect(freeSlotFor({ item: 'Ring of Warmth' }, { ring1: { id: 'x' } })).toBe('ring2')
  })
})

describe('worn items', () => {
  it('places items by their slot, and older equipped items where they fit', () => {
    const worn = layoutEquipment([
      { id: 'a', item: 'Longsword', equipped: true, equipSlot: 'main' },
      { id: 'b', item: 'Dagger', equipped: true }, // main is taken: not shown on the figure
      { id: 'c', item: 'Boots of Speed', equipped: true },
      { id: 'd', item: 'Rope', equipped: false },
    ])
    expect(Object.fromEntries(Object.entries(worn).map(([k, v]) => [k, v.id]))).toEqual({ main: 'a', feet: 'c' })
  })
  it('equipping into a taken slot takes the old item off', () => {
    const worn = { main: { id: 'a' } }
    expect(equipChanges(worn, { id: 'b' }, 'main')).toEqual([
      { id: 'a', patch: { equipped: false, equip_slot: null } },
      { id: 'b', patch: { equipped: true, equip_slot: 'main' } },
    ])
  })
})
