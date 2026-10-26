// The equipment window: where on the body each equipped item is worn.
// Stored as loot.equip_slot; `equipped` stays true while it's worn, so
// the rest of the app (Loot list, trades) still knows.

export const EQUIP_SLOTS = [
  { id: 'head', label: 'Head', side: 'left', icon: 'crown' },
  { id: 'neck', label: 'Neck', side: 'left', icon: 'gem' },
  { id: 'back', label: 'Cloak', side: 'left', icon: 'cloak' },
  { id: 'body', label: 'Armour', side: 'left', icon: 'shirt' },
  { id: 'waist', label: 'Belt', side: 'left', icon: 'belt' },
  { id: 'feet', label: 'Boots', side: 'left', icon: 'boots' },
  { id: 'main', label: 'Main hand', side: 'right', icon: 'sword' },
  { id: 'off', label: 'Off hand', side: 'right', icon: 'shield' },
  { id: 'hands', label: 'Gloves', side: 'right', icon: 'hand' },
  { id: 'ring1', label: 'Ring', side: 'right', icon: 'ring' },
  { id: 'ring2', label: 'Ring', side: 'right', icon: 'ring' },
]
export const SLOT_IDS = EQUIP_SLOTS.map((s) => s.id)
export const slotLabel = (id) => EQUIP_SLOTS.find((s) => s.id === id)?.label || id

const RULES = [
  ['head', /\b(helm|helmet|hat|cap|hood|circlet|crown|diadem|headband|mask)s?\b/i],
  ['neck', /\b(amulet|necklace|pendant|periapt|medallion|torc|choker|scarab)s?\b/i],
  ['back', /\b(cloak|cape|mantle|wings)s?\b/i],
  ['hands', /\b(gloves|gauntlets|bracers|bracelet)s?\b/i],
  ['waist', /\b(belt|girdle|sash)s?\b/i],
  ['feet', /\b(boots|shoes|slippers|sandals|greaves)\b/i],
  ['ring', /\brings?\b/i],
  ['off', /\b(shield|buckler|tome|orb|torch|lantern)s?\b/i],
  ['body', /\b(armou?r|mail|plate|breastplate|robes?|vest|tunic|coat|leathers?|chain shirt|brigandine)\b/i],
]

// The kind of slot an item goes in ('ring' for either ring slot);
// weapons and anything unrecognised go in the main hand.
export function guessSlotKind(entry) {
  const name = entry.item || ''
  for (const [kind, pattern] of RULES) if (pattern.test(name)) return kind
  return 'main'
}

// What's worn where: { slotId: item }. Items marked equipped before the
// window existed (no slot yet) are shown in the slot they'd go in, if free.
export function layoutEquipment(items) {
  const worn = {}
  const legacy = []
  for (const item of items) {
    if (!item.equipped && !item.equipSlot) continue
    if (SLOT_IDS.includes(item.equipSlot) && !worn[item.equipSlot]) worn[item.equipSlot] = item
    else legacy.push(item)
  }
  for (const item of legacy) {
    const slot = freeSlotFor(item, worn)
    if (slot && !worn[slot]) worn[slot] = item
  }
  return worn
}

// Where to put an item when you just press Equip: its kind of slot, the
// free ring slot for rings; if that's taken, it replaces what's there.
export function freeSlotFor(item, worn) {
  const kind = guessSlotKind(item)
  if (kind === 'ring') return !worn.ring1 ? 'ring1' : !worn.ring2 ? 'ring2' : 'ring1'
  return kind
}

// The saves for putting `item` in `slotId`: whatever was there comes off
// (back to the bag), and the item leaves any slot it was in.
export function equipChanges(worn, item, slotId) {
  const changes = []
  const occupant = worn[slotId]
  if (occupant && occupant.id !== item.id) changes.push({ id: occupant.id, patch: { equipped: false, equip_slot: null } })
  changes.push({ id: item.id, patch: { equipped: true, equip_slot: slotId } })
  return changes
}

export const unequipPatch = { equipped: false, equip_slot: null }
