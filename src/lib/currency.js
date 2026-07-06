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
