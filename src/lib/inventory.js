// The MapleStory-style inventory: each character's (and the party
// stash's) loot sorted into bags, laid out in a grid of slots. Built on
// the loot table: an item belongs to whoever its `holder` names.

export const BAGS = [
  { id: 'equip', label: 'Equip', icon: 'shield' },
  { id: 'use', label: 'Use', icon: 'flame' },
  { id: 'etc', label: 'Etc', icon: 'gem' },
  { id: 'quest', label: 'Quest', icon: 'scroll' },
]
export const BAG_IDS = BAGS.map((b) => b.id)

export const STASH = '__stash__'
const STASH_NAMES = new Set(['', 'party', 'party stash', 'stash', 'the party'])

const EQUIP_WORDS =
  /\b(?:great|long|short|broad|battle|hand|war|light|heavy)?(sword|scimitar|rapier|blade|dagger|axe|mace|hammer|spear|bow|crossbow|staff|wand|rod|armou?r|mail|plate|shield|helm|helmet|hat|cloak|cape|robe|boots|gloves|gauntlets|bracers|belt|ring|amulet|necklace|circlet|pendant)s?\b/i
const QUEST_WORDS = /\b(key|letter|map|deed|seal|note|journal|diary|invitation|sigil|token|writ|contract|relic)\b/i

// Where an item goes when nobody has picked a bag for it.
export function guessBag(entry) {
  if (entry.usable) return 'use'
  const name = entry.item || ''
  if (QUEST_WORDS.test(name)) return 'quest'
  if (entry.kind === 'Magic Item' || entry.kind === 'Artifact' || EQUIP_WORDS.test(name)) return 'equip'
  return 'etc'
}

export const bagOf = (entry) => (BAG_IDS.includes(entry.bag) ? entry.bag : guessBag(entry))

export const isStashHolder = (holder) => STASH_NAMES.has(String(holder || '').trim().toLowerCase())

// Whose inventory an item is in: a character's name, or STASH.
export function ownerKey(holder) {
  return isStashHolder(holder) ? STASH : String(holder).trim().toLowerCase()
}

export const COLUMNS = 4
const MIN_ROWS = 6

// A bag's slots in order (an item, or null when empty). Items keep the
// slot they were put in; the rest fill the first free slots, oldest
// first. There's always at least one free row.
export function layoutBag(items) {
  const placed = new Map()
  const loose = []
  for (const item of [...items].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))) {
    if (Number.isInteger(item.slot) && item.slot >= 0 && !placed.has(item.slot)) placed.set(item.slot, item)
    else loose.push(item)
  }
  const highest = placed.size ? Math.max(...placed.keys()) + 1 : 0
  const needed = Math.max(highest, placed.size + loose.length)
  const size = Math.max(MIN_ROWS * COLUMNS, Math.ceil((needed + COLUMNS) / COLUMNS) * COLUMNS)
  const slots = Array.from({ length: size }, (_, i) => placed.get(i) || null)
  let next = 0
  for (const item of loose) {
    while (slots[next]) next++
    slots[next] = item
  }
  return slots
}

// Moving the item in slot `from` to slot `to`: it swaps with whatever is
// there. Returns the { id, slot } changes to save.
export function moveSlot(slots, from, to) {
  if (from === to || !slots[from]) return []
  const changes = [{ id: slots[from].id, slot: to }]
  if (slots[to]) changes.push({ id: slots[to].id, slot: from })
  return changes
}

// Items that stack (potions, arrows, gems): everything but equipment.
export const stacks = (bag) => bag !== 'equip'

// An existing stack of the same item for this holder, to add to.
export function findStack(loot, { item, holder, bag }) {
  if (!stacks(bag)) return null
  const name = item.trim().toLowerCase()
  const owner = ownerKey(holder)
  return (
    loot.find(
      (l) => l.item.trim().toLowerCase() === name && ownerKey(l.holder) === owner && bagOf(l) === bag && !l.used,
    ) || null
  )
}
