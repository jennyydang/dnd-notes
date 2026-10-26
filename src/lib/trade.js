import { supabase } from './supabaseClient.js'
import { addToCounts, spendFromCounts, totalValue } from './currency.js'
import { bagOf, findStack, ownerKey } from './inventory.js'

// Player-to-player trades, MapleStory style. A trade row is shared by both
// players' screens (realtime): each side offers items ([{ id, qty }]) and
// coins, and presses Trade. Changing either offer clears both presses;
// once both have pressed, the swap runs once and the trade is done.
//
// status: invite → open → executing → done, or cancelled / declined.

export const ACTIVE = ['invite', 'open', 'executing']

export const tradeFromRow = (r) => ({
  id: r.id,
  campaignId: r.campaign_id,
  fromPlayer: r.from_player,
  toPlayer: r.to_player,
  fromHolder: r.from_holder,
  toHolder: r.to_holder,
  fromOffer: Array.isArray(r.from_offer) ? r.from_offer : [],
  toOffer: Array.isArray(r.to_offer) ? r.to_offer : [],
  fromCoins: r.from_coins_cp || 0,
  toCoins: r.to_coins_cp || 0,
  fromReady: Boolean(r.from_ready),
  toReady: Boolean(r.to_ready),
  status: r.status,
  messages: Array.isArray(r.messages) ? r.messages : [],
  createdAt: r.created_at,
})

// The trade from one player's point of view: "me" and "them".
export function sides(trade, playerId) {
  const mine = trade.fromPlayer === playerId ? 'from' : 'to'
  const theirs = mine === 'from' ? 'to' : 'from'
  const side = (key) => ({
    key,
    player: trade[`${key}Player`],
    holder: trade[`${key}Holder`],
    offer: trade[`${key}Offer`],
    coins: trade[`${key}Coins`],
    ready: trade[`${key}Ready`],
  })
  return { me: side(mine), them: side(theirs) }
}

// The columns to write when one side changes their offer: both presses
// are cleared, so nobody accepts a deal that changed under them.
export function offerPatch(sideKey, { offer, coins }) {
  const patch = { from_ready: false, to_ready: false, updated_at: new Date().toISOString() }
  if (offer) patch[`${sideKey}_offer`] = offer
  if (coins != null) patch[`${sideKey}_coins_cp`] = Math.max(0, Math.round(coins))
  return patch
}

// Works out the swap: which loot rows move, split or stack, and both
// purses afterwards. Throws (with a reason both players can read) if an
// item is gone, someone is short of coins, etc. Pure, for testing.
export function planTrade(trade, loot, wallets) {
  // Worked on a running copy, so when both sides trade the same kind of
  // item (potions for potions) each move sees the stacks as they now are.
  const original = new Map(loot.map((l) => [l.id, l]))
  const state = new Map(loot.map((l) => [l.id, { ...l }]))
  const removed = new Set()
  const inserts = []

  for (const [giver, receiver] of [
    ['from', 'to'],
    ['to', 'from'],
  ]) {
    const giverHolder = trade[`${giver}Holder`]
    const receiverHolder = trade[`${receiver}Holder`]
    for (const { id, qty } of trade[`${giver}Offer`]) {
      const before = original.get(id)
      const item = state.get(id)
      if (!before || removed.has(id) || ownerKey(item.holder) !== ownerKey(giverHolder)) {
        throw new Error(`${giverHolder} no longer has one of the offered items.`)
      }
      if (before.quantity !== null && qty > before.quantity) throw new Error(`${giverHolder} only has ${before.quantity} ${before.item}.`)
      const amount = item.quantity === null ? 1 : Math.min(qty, item.quantity)
      const whole = item.quantity === null || amount >= item.quantity
      const live = [...state.values()].filter((l) => l.id !== id && !removed.has(l.id))
      const stack = item.quantity !== null ? findStack(live, { item: item.item, holder: receiverHolder, bag: bagOf(item) }) : null
      if (stack) {
        stack.quantity = (stack.quantity ?? 1) + amount
        if (whole) removed.add(id)
        else item.quantity -= amount
      } else if (whole) {
        Object.assign(item, { holder: receiverHolder, slot: null, equipped: false })
      } else {
        item.quantity -= amount
        inserts.push({
          campaign_id: trade.campaignId,
          item: item.item,
          kind: item.kind,
          bag: item.bag,
          notes: item.notes,
          usable: item.usable,
          quantity: amount,
          holder: receiverHolder,
          found_at: `Traded from ${giverHolder}`,
          value_cp: item.valueCp,
          photo_path: item.photoPath,
        })
      }
    }
  }

  const updates = []
  for (const [id, after] of state) {
    const before = original.get(id)
    if (removed.has(id)) {
      updates.push({ id, remove: true })
      continue
    }
    const patch = {}
    if (after.quantity !== before.quantity) patch.quantity = after.quantity
    if (after.holder !== before.holder) {
      Object.assign(patch, { holder: after.holder, slot: null, equipped: false })
      // Only written when it was worn, so trades work before that column exists.
      if (before.equipSlot) patch.equip_slot = null
    }
    if (Object.keys(patch).length) updates.push({ id, patch })
  }

  const purse = (playerId) => wallets.find((w) => w.player_id === playerId) || null
  const empty = { platinum: 0, gold: 0, silver: 0, shilling: 0, copper: 0 }
  const walletChanges = []
  if (trade.fromCoins || trade.toCoins) {
    for (const [payer, payee] of [
      ['from', 'to'],
      ['to', 'from'],
    ]) {
      const amount = trade[`${payer}Coins`]
      if (!amount) continue
      const wallet = purse(trade[`${payer}Player`])
      if (!wallet || totalValue(wallet) < amount) throw new Error(`${trade[`${payer}Holder`]} doesn’t have enough coins any more.`)
    }
    const after = {}
    for (const key of ['from', 'to']) {
      const w = purse(trade[`${key}Player`])
      after[key] = w ? { ...empty, ...pick(w) } : { ...empty }
    }
    if (trade.fromCoins) after.from = spendFromCounts(after.from, trade.fromCoins)
    if (trade.toCoins) after.to = spendFromCounts(after.to, trade.toCoins)
    if (trade.fromCoins) after.to = addToCounts(after.to, trade.fromCoins)
    if (trade.toCoins) after.from = addToCounts(after.from, trade.toCoins)
    for (const key of ['from', 'to']) {
      const w = purse(trade[`${key}Player`])
      walletChanges.push({ id: w?.id || null, playerId: trade[`${key}Player`], counts: after[key] })
    }
  }
  return { updates, inserts, walletChanges }
}

const pick = (w) => ({ platinum: w.platinum, gold: w.gold, silver: w.silver, shilling: w.shilling, copper: w.copper })

const lootRow = (r) => ({
  id: r.id,
  item: r.item,
  kind: r.kind || '',
  holder: r.holder || '',
  notes: r.notes || '',
  usable: Boolean(r.usable),
  used: Boolean(r.used),
  quantity: r.quantity ?? null,
  photoPath: r.photo_path || null,
  bag: r.bag || '',
  valueCp: r.value_cp ?? null,
  equipSlot: r.equip_slot || null,
})

// Runs the swap. Only one screen gets to: the status flips open →
// executing only where it's still open.
export async function executeTrade(tradeId) {
  const { data: claimed, error: claimError } = await supabase
    .from('trades')
    .update({ status: 'executing' })
    .eq('id', tradeId)
    .eq('status', 'open')
    .eq('from_ready', true)
    .eq('to_ready', true)
    .select()
    .maybeSingle()
  if (claimError) throw new Error(claimError.message)
  if (!claimed) return false // the other screen is doing it
  const trade = tradeFromRow(claimed)
  try {
    const { data: lootRows, error: lootError } = await supabase.from('loot').select('*').eq('campaign_id', trade.campaignId)
    if (lootError) throw new Error(lootError.message)
    const { data: wallets, error: walletError } = await supabase.from('player_wallets').select('*').eq('campaign_id', trade.campaignId)
    if (walletError) throw new Error(walletError.message)
    const plan = planTrade(trade, (lootRows || []).map(lootRow), wallets || [])
    for (const u of plan.updates) {
      const q = u.remove ? supabase.from('loot').delete().eq('id', u.id) : supabase.from('loot').update(u.patch).eq('id', u.id)
      const { error } = await q
      if (error) throw new Error(error.message)
    }
    if (plan.inserts.length) {
      const { error } = await supabase.from('loot').insert(plan.inserts)
      if (error) throw new Error(error.message)
    }
    for (const w of plan.walletChanges) {
      const { error } = w.id
        ? await supabase.from('player_wallets').update(w.counts).eq('id', w.id)
        : await supabase.from('player_wallets').insert({ campaign_id: trade.campaignId, player_id: w.playerId, ...w.counts })
      if (error) throw new Error(error.message)
    }
    await supabase.from('trades').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', tradeId)
    return true
  } catch (err) {
    // Nothing moved past the failure point is undone automatically, but a
    // failed check (the usual case) happens before anything is written.
    await supabase
      .from('trades')
      .update({ status: 'open', from_ready: false, to_ready: false, messages: [...trade.messages, { system: true, text: `Trade failed: ${err.message}`, at: new Date().toISOString() }] })
      .eq('id', tradeId)
    throw err
  }
}
