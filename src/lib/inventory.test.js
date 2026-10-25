import { describe, expect, it } from 'vitest'
import { bagOf, findStack, guessBag, layoutBag, moveSlot, ownerKey, STASH } from './inventory.js'
import { addToCounts, formatCoins, goldToCopper, spendFromCounts } from './currency.js'

describe('bags', () => {
  it('guesses where things go', () => {
    expect(guessBag({ item: 'Potion of Healing', usable: true })).toBe('use')
    expect(guessBag({ item: 'Longsword +1' })).toBe('equip')
    expect(guessBag({ item: 'Cloak', kind: '' })).toBe('equip')
    expect(guessBag({ item: 'Strange orb', kind: 'Artifact' })).toBe('equip')
    expect(guessBag({ item: 'Rusty key to the crypt' })).toBe('quest')
    expect(guessBag({ item: 'Wolf pelt' })).toBe('etc')
  })
  it('a chosen bag wins over the guess', () => {
    expect(bagOf({ item: 'Longsword', bag: 'etc' })).toBe('etc')
    expect(bagOf({ item: 'Longsword', bag: 'nonsense' })).toBe('equip')
  })
  it('treats blank and "Party" holders as the stash', () => {
    expect(ownerKey('')).toBe(STASH)
    expect(ownerKey(' Party Stash ')).toBe(STASH)
    expect(ownerKey(' Thessaly ')).toBe('thessaly')
  })
})

describe('slots', () => {
  const items = [
    { id: 'a', createdAt: '1', slot: 5 },
    { id: 'b', createdAt: '2' },
    { id: 'c', createdAt: '3', slot: 5 }, // clash: falls back to a free slot
  ]
  it('keeps chosen slots and fills the rest in order, with a free row', () => {
    const slots = layoutBag(items)
    expect(slots[5].id).toBe('a')
    expect(slots[0].id).toBe('b')
    expect(slots[1].id).toBe('c')
    expect(slots.length).toBe(24)
  })
  it('grows past the minimum, keeping a spare row', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), createdAt: String(i) }))
    expect(layoutBag(many).length).toBe(32)
  })
  it('moving swaps with what is there', () => {
    const slots = layoutBag(items)
    expect(moveSlot(slots, 0, 5)).toEqual([{ id: 'b', slot: 5 }, { id: 'a', slot: 0 }])
    expect(moveSlot(slots, 0, 9)).toEqual([{ id: 'b', slot: 9 }])
    expect(moveSlot(slots, 9, 0)).toEqual([])
  })
})

describe('stacking', () => {
  const loot = [
    { id: '1', item: 'Potion of Healing', holder: 'Aria', usable: true, used: false },
    { id: '2', item: 'Longsword', holder: 'Aria' },
  ]
  it('finds the same consumable for the same holder', () => {
    expect(findStack(loot, { item: 'potion of healing ', holder: 'aria', bag: 'use' })?.id).toBe('1')
    expect(findStack(loot, { item: 'Potion of Healing', holder: 'Bram', bag: 'use' })).toBeNull()
  })
  it("doesn't stack equipment", () => {
    expect(findStack(loot, { item: 'Longsword', holder: 'Aria', bag: 'equip' })).toBeNull()
  })
})

describe('coins', () => {
  it('formats copper as coins', () => {
    expect(formatCoins(12345)).toBe('12g 3s 4sh 5c')
    expect(formatCoins(500)).toBe('5s')
    expect(formatCoins(0)).toBe('0c')
  })
  it('reads a gold price', () => {
    expect(goldToCopper('2.5')).toBe(2500)
  })
  it('pays and gets paid', () => {
    const purse = { platinum: 0, gold: 3, silver: 0, shilling: 0, copper: 0 }
    expect(spendFromCounts(purse, 1250)).toEqual({ platinum: 0, gold: 1, silver: 7, shilling: 5, copper: 0 })
    expect(addToCounts(purse, 1250)).toEqual({ platinum: 0, gold: 4, silver: 2, shilling: 5, copper: 0 })
  })
})
