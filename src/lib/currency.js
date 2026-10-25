// Homebrew currency ladder: platinum and gold are equally rare and worth
// the same (unlike the standard 1pp = 10gp rule), gold divides into 10
// silver, silver into 10 shillings, shillings into 10 copper. Everything
// is expressed in copper (the smallest unit) so any two currencies can be
// converted through a common base.
export const CURRENCIES = [
  { id: 'platinum', label: 'Platinum', copperValue: 1000 },
  { id: 'gold', label: 'Gold', copperValue: 1000 },
  { id: 'silver', label: 'Silver', copperValue: 100 },
  { id: 'shilling', label: 'Shilling', copperValue: 10 },
  { id: 'copper', label: 'Copper', copperValue: 1 },
]

export function formatAmount(value) {
  return Number(value.toFixed(2)).toString()
}

export function toCopper(amount, currencyId) {
  const currency = CURRENCIES.find((c) => c.id === currencyId)
  return amount * currency.copperValue
}

export function totalValue(counts) {
  return CURRENCIES.reduce((sum, c) => sum + (counts[c.id] || 0) * c.copperValue, 0)
}

// Spending a specific denomination you don't have enough of means breaking
// a higher-value coin for change — exactly like a real coin purse. The
// currency ladder is a clean base-10 chain (gold=10 silver=10 shillings=10
// copper), so subtracting the spend from the total "ordinary" value and
// re-expressing what's left via floor division reproduces manual
// decimal subtraction-with-borrowing: any denomination the subtraction
// doesn't need to break is left exactly as it was. Platinum sits outside
// that chain (worth the same as gold, but not part of everyday spending
// per this world's lore) and is only broken — 1-for-1 into gold — as a
// last resort if gold/silver/shilling/copper alone can't cover it.
export function spendFromCounts(counts, spendCopper) {
  const ordinaryCopper =
    counts.gold * 1000 + counts.silver * 100 + counts.shilling * 10 + counts.copper
  const platinumCopper = counts.platinum * 1000

  if (spendCopper > ordinaryCopper + platinumCopper) {
    throw new Error('Not enough money for that.')
  }

  let platinum = counts.platinum
  let usableOrdinary = ordinaryCopper
  if (spendCopper > ordinaryCopper) {
    const shortfall = spendCopper - ordinaryCopper
    const platinumToBreak = Math.ceil(shortfall / 1000)
    platinum -= platinumToBreak
    usableOrdinary += platinumToBreak * 1000
  }

  const remainder = usableOrdinary - spendCopper
  const gold = Math.floor(remainder / 1000)
  const afterGold = remainder - gold * 1000
  const silver = Math.floor(afterGold / 100)
  const afterSilver = afterGold - silver * 100
  const shilling = Math.floor(afterSilver / 10)
  const copper = afterSilver - shilling * 10

  return { platinum, gold, silver, shilling, copper }
}

// Coins received (a sale): paid out as gold, silver, shillings and copper.
export function addToCounts(counts, copper) {
  const gold = Math.floor(copper / 1000)
  const silver = Math.floor((copper % 1000) / 100)
  const shilling = Math.floor((copper % 100) / 10)
  return {
    ...counts,
    gold: (counts.gold || 0) + gold,
    silver: (counts.silver || 0) + silver,
    shilling: (counts.shilling || 0) + shilling,
    copper: (counts.copper || 0) + (copper % 10),
  }
}

const SHORT = [
  ['g', 1000],
  ['s', 100],
  ['sh', 10],
  ['c', 1],
]

// A price in copper as coins: 1250 → "1g 2s 5sh".
export function formatCoins(copper) {
  let left = Math.max(0, Math.round(copper || 0))
  const parts = []
  for (const [label, value] of SHORT) {
    const n = Math.floor(left / value)
    left -= n * value
    if (n) parts.push(`${n.toLocaleString()}${label}`)
  }
  return parts.join(' ') || '0c'
}

// "12.5" gold (what the DM types) → copper.
export const goldToCopper = (gold) => Math.max(0, Math.round((Number(gold) || 0) * 1000))
