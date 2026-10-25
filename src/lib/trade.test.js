import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient.js', () => ({ supabase: {} }))
const { planTrade, offerPatch, sides } = await import('./trade.js')

const base = {
  campaignId: 'c1',
  fromPlayer: 'p1',
  toPlayer: 'p2',
  fromHolder: 'Aria',
  toHolder: 'Bram',
  fromOffer: [],
  toOffer: [],
  fromCoins: 0,
  toCoins: 0,
}
const loot = [
  { id: 'sword', item: 'Longsword', holder: 'Aria', quantity: null, bag: 'equip' },
  { id: 'potA', item: 'Potion of Healing', holder: 'Aria', quantity: 5, usable: true },
  { id: 'potB', item: 'Potion of Healing', holder: 'Bram', quantity: 1, usable: true },
  { id: 'pelt', item: 'Wolf pelt', holder: 'Aria', quantity: 4 },
]
const wallets = [
  { id: 'w1', player_id: 'p1', platinum: 0, gold: 3, silver: 0, shilling: 0, copper: 0 },
  { id: 'w2', player_id: 'p2', platinum: 0, gold: 0, silver: 5, shilling: 0, copper: 0 },
]

describe('planTrade', () => {
  it('hands a whole item over', () => {
    const plan = planTrade({ ...base, fromOffer: [{ id: 'sword', qty: 1 }] }, loot, wallets)
    expect(plan.updates).toEqual([{ id: 'sword', patch: { holder: 'Bram', slot: null, equipped: false } }])
  })
  it('stacks potions onto what the other side carries', () => {
    const plan = planTrade({ ...base, fromOffer: [{ id: 'potA', qty: 2 }] }, loot, wallets)
    expect(plan.updates).toEqual([
      { id: 'potA', patch: { quantity: 3 } },
      { id: 'potB', patch: { quantity: 3 } },
    ])
  })
  it('splits a stack the other side has none of', () => {
    const plan = planTrade({ ...base, fromOffer: [{ id: 'pelt', qty: 1 }] }, loot, wallets)
    expect(plan.updates).toEqual([{ id: 'pelt', patch: { quantity: 3 } }])
    expect(plan.inserts[0]).toMatchObject({ item: 'Wolf pelt', quantity: 1, holder: 'Bram', found_at: 'Traded from Aria' })
  })
  it('potions for potions: each side ends with the right count', () => {
    const plan = planTrade({ ...base, fromOffer: [{ id: 'potA', qty: 2 }], toOffer: [{ id: 'potB', qty: 1 }] }, loot, wallets)
    expect(plan.updates).toEqual([
      { id: 'potA', patch: { quantity: 4 } },
      { id: 'potB', patch: { quantity: 2 } },
    ])
    expect(plan.inserts).toEqual([])
  })
  it('a whole stack given to someone with none just changes hands', () => {
    const plan = planTrade({ ...base, fromOffer: [{ id: 'pelt', qty: 4 }] }, loot, wallets)
    expect(plan.updates).toEqual([{ id: 'pelt', patch: { holder: 'Bram', slot: null, equipped: false } }])
  })
  it('swaps coins both ways', () => {
    const plan = planTrade({ ...base, fromCoins: 1500, toCoins: 200 }, loot, wallets)
    const [from, to] = plan.walletChanges
    expect(from.counts).toEqual({ platinum: 0, gold: 1, silver: 7, shilling: 0, copper: 0 })
    expect(to.counts).toEqual({ platinum: 0, gold: 1, silver: 8, shilling: 0, copper: 0 })
  })
  it('stops if an item moved or coins ran out', () => {
    expect(() => planTrade({ ...base, toOffer: [{ id: 'sword', qty: 1 }] }, loot, wallets)).toThrow(/Bram no longer has/)
    expect(() => planTrade({ ...base, toCoins: 900 }, loot, wallets)).toThrow(/Bram doesn’t have enough coins/)
  })
})

describe('offers', () => {
  it('changing an offer clears both presses', () => {
    expect(offerPatch('to', { coins: 12.4 })).toMatchObject({ from_ready: false, to_ready: false, to_coins_cp: 12 })
  })
  it('sees the trade from either side', () => {
    expect(sides({ ...base, fromReady: true, toReady: false }, 'p2').me).toMatchObject({ key: 'to', holder: 'Bram', ready: false })
  })
})
