import { TAG_GROUPS } from './tags.js'

// The kinds of entry that can be created in one step. Each maps onto an
// existing table/tab — a "clue" is a Lore entry with category Clue.
export const QUICK_TYPES = {
  npc: { label: 'NPC', icon: '👤', entity: 'npc', nameLabel: 'Name', placeholder: 'Elandra Voss' },
  place: {
    label: 'Location',
    icon: '📍',
    entity: 'place',
    nameLabel: 'Name',
    placeholder: 'The Sunken Crypt',
    kinds: TAG_GROUPS.place.kinds,
  },
  quest: { label: 'Quest', icon: '⚔️', entity: 'quest', nameLabel: 'Quest', placeholder: 'Find the missing caravan' },
  clue: { label: 'Clue', icon: '🔎', entity: 'lore', nameLabel: 'Clue', placeholder: 'Black wax seal with a heron' },
  lore: {
    label: 'Lore',
    icon: '📜',
    entity: 'lore',
    nameLabel: 'Title',
    placeholder: 'The Sundering',
    kinds: TAG_GROUPS.lore.kinds,
  },
  loot: {
    label: 'Loot',
    icon: '💰',
    entity: 'loot',
    nameLabel: 'Item',
    placeholder: 'Ring of Feather Falling',
    kinds: TAG_GROUPS.loot.kinds,
  },
}

export function payloadFor(type, { name, kind, notes, extra }) {
  switch (type) {
    case 'npc':
      return { name, description: notes, met_at: extra }
    case 'place':
      return { name, kind: kind || 'Location', notes }
    case 'quest':
      return { name, status: 'Active', given_by: extra, notes }
    case 'clue':
      return { title: name, category: 'Clue', notes }
    case 'lore':
      return { title: name, category: kind, notes }
    case 'loot':
      return { item: name, kind, found_at: extra, holder: '', notes }
    default:
      throw new Error(`Unknown type ${type}`)
  }
}

export const EXTRA_LABELS = { npc: 'Where you met', quest: 'Given by', loot: 'Where you got it' }
