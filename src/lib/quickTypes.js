import { TAG_GROUPS } from './tags.js'
import { TERM_KINDS } from './dictionary.js'

// The kinds of entry that can be created in one step. Each maps onto an
// existing table/tab — a "clue" is a Lore entry with category Clue,
// optionally on a mystery (`extra`) and stamped with the running session.
export const QUICK_TYPES = {
  npc: { label: 'NPC', icon: 'user', entity: 'npc', nameLabel: 'Name', placeholder: 'Elandra Voss' },
  place: {
    label: 'Location',
    icon: 'pin',
    entity: 'place',
    nameLabel: 'Name',
    placeholder: 'The Sunken Crypt',
    kinds: TAG_GROUPS.place.kinds,
  },
  quest: { label: 'Quest', icon: 'quest', entity: 'quest', nameLabel: 'Quest', placeholder: 'Find the missing caravan' },
  clue: { label: 'Clue', icon: 'search', entity: 'lore', nameLabel: 'Clue', placeholder: 'Black wax seal with a heron' },
  lore: {
    label: 'Lore',
    icon: 'scroll',
    entity: 'lore',
    nameLabel: 'Title',
    placeholder: 'The Sundering',
    kinds: TAG_GROUPS.lore.kinds,
  },
  loot: {
    label: 'Loot',
    icon: 'coins',
    entity: 'loot',
    nameLabel: 'Item',
    placeholder: 'Ring of Feather Falling',
    kinds: TAG_GROUPS.loot.kinds,
  },
  word: {
    label: 'Word',
    icon: 'speech',
    entity: 'term',
    nameLabel: 'Word',
    placeholder: 'Vistani',
    kinds: TERM_KINDS,
    kindLabel: 'Kind',
    kindRequired: true,
    notesLabel: 'Meaning',
  },
  // A character in the party: a player's or a companion NPC.
  party: {
    label: 'Party member',
    icon: 'users',
    entity: 'character',
    nameLabel: 'Name',
    placeholder: 'Thessaly Brightwater',
    kinds: ['Player', 'NPC'],
    kindLabel: 'Who plays them',
    kindRequired: true,
  },
}

export function payloadFor(type, { name, kind, notes, extra, session = '' }) {
  switch (type) {
    case 'npc':
      return { name, description: notes, met_at: extra }
    case 'place':
      return { name, kind: kind || 'Location', notes }
    case 'quest':
      return { name, status: 'Active', given_by: extra, notes }
    case 'clue':
      // Only send the newer columns when there's something in them, so a
      // database without the Mysteries update can still take a clue.
      return {
        title: name,
        category: 'Clue',
        notes,
        ...(extra ? { mystery_id: extra } : {}),
        ...(session ? { found_in: session } : {}),
      }
    case 'lore':
      return { title: name, category: kind, notes }
    case 'loot':
      return { item: name, kind, found_at: extra, holder: '', notes }
    case 'word':
      return { term: name, kind: kind || 'Word', pronunciation: extra, meaning: notes }
    case 'party':
      return { name, member_type: kind || 'Player', race_class: extra, notes }
    default:
      throw new Error(`Unknown type ${type}`)
  }
}

export const EXTRA_LABELS = { npc: 'Where you met', quest: 'Given by', loot: 'Where you got it', party: 'Race & class', word: 'How to say it' }
