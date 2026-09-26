import { notesToPlainText } from './richNotes.js'

// One registry describing every kind of campaign entry the app can search,
// link and show in a detail view. Each type maps an existing table onto a
// common shape — { type, id, title, subtitle, body, tags, createdAt, raw }
// — so search, links and the Home/Prep summaries work across all of them
// without a parallel copy of the data.
//
// `scope: 'player'` tables are private per player (filtered by player_id);
// the rest are shared by the whole campaign. `tab` is where the entry's
// full editor lives in CampaignView.

const text = (value) => (value == null ? '' : String(value))

export const ENTITY_TYPES = {
  npc: {
    table: 'npcs',
    label: 'NPC',
    plural: 'NPCs',
    icon: '👤',
    tab: 'npcs',
    normalize: (r) => ({
      title: text(r.name),
      subtitle: [r.race, r.status, r.met_at && `Met: ${r.met_at}`].filter(Boolean).join(' · '),
      body: text(r.description),
      tags: [r.status].filter(Boolean),
    }),
  },
  place: {
    table: 'places',
    label: 'Location',
    plural: 'Locations',
    icon: '📍',
    tab: 'maps',
    normalize: (r) => ({
      title: text(r.name),
      subtitle: text(r.kind),
      body: text(r.notes),
      tags: [r.kind].filter(Boolean),
    }),
  },
  quest: {
    table: 'quests',
    label: 'Quest',
    plural: 'Quests',
    icon: '⚔️',
    tab: 'quests',
    normalize: (r) => ({
      title: text(r.name),
      subtitle: [r.status, r.given_by && `Given by ${r.given_by}`].filter(Boolean).join(' · '),
      body: text(r.notes),
      tags: [r.status].filter(Boolean),
      open: r.status === 'Active',
    }),
  },
  lore: {
    table: 'lore_entries',
    label: 'Lore',
    plural: 'Lore & clues',
    icon: '📜',
    tab: 'lore',
    normalize: (r) => ({
      title: text(r.title),
      subtitle: text(r.category),
      body: text(r.notes),
      tags: [r.category].filter(Boolean),
      // Clues are lore entries with category "Clue" — see TAG_GROUPS.lore.
      label: /^clue$/i.test(text(r.category).trim()) ? 'Clue' : undefined,
    }),
  },
  loot: {
    table: 'loot',
    label: 'Loot',
    plural: 'Loot',
    icon: '💰',
    tab: 'loot',
    normalize: (r) => ({
      title: text(r.item),
      subtitle: [r.kind, r.holder && `Held by ${r.holder}`, r.used && 'Used']
        .filter(Boolean)
        .join(' · '),
      body: [r.found_at && `Found: ${r.found_at}`, r.notes].filter(Boolean).join('\n'),
      tags: [r.kind].filter(Boolean),
    }),
  },
  session: {
    table: 'session_notes',
    label: 'Session',
    plural: 'Sessions',
    icon: '📖',
    tab: 'sessions',
    scope: 'player',
    normalize: (r) => ({
      title: text(r.title) || 'Untitled Session',
      subtitle: text(r.session_date),
      body: notesToPlainText(r.notes),
      tags: [],
    }),
  },
  note: {
    table: 'quick_notes',
    label: 'Quick note',
    plural: 'Quick notes',
    icon: '✏️',
    tab: 'session',
    scope: 'player',
    normalize: (r) => ({
      title: firstLine(r.content),
      subtitle: '',
      body: text(r.content),
      tags: r.converted_to ? ['converted'] : [],
    }),
  },
  character: {
    table: 'party_members',
    label: 'Character',
    plural: 'Party',
    icon: '🎭',
    tab: 'party',
    normalize: (r) => ({
      title: text(r.name),
      subtitle: [r.race_class, r.level && `Level ${r.level}`, r.member_type]
        .filter(Boolean)
        .join(' · '),
      body: text(r.notes),
      tags: [r.member_type].filter(Boolean),
    }),
  },
  goal: {
    table: 'party_goals',
    label: 'Party goal',
    plural: 'Party goals',
    icon: '🎯',
    tab: 'party',
    normalize: (r) => ({
      title: text(r.title),
      subtitle: text(r.status),
      body: text(r.notes),
      tags: [r.status].filter(Boolean),
      open: r.status === 'Active',
    }),
  },
}

// Searchable but not stored as linkable rows of their own kind: spells
// (private per player), maps and their pins, custom-tab entries, and
// timeline events (read out of session recaps — see CampaignDataProvider).
Object.assign(ENTITY_TYPES, {
  spell: {
    table: 'spells',
    label: 'Spell',
    plural: 'Spells',
    icon: '✨',
    tab: 'spells',
    scope: 'player',
    normalize: (r) => ({
      title: text(r.name),
      subtitle: [r.level === 0 ? 'Cantrip' : `Level ${r.level}`, r.casting_time, r.range].filter(Boolean).join(' · '),
      body: [r.effect, r.details, r.flavor].filter(Boolean).join('\n'),
      tags: [r.level === 0 ? 'Cantrip' : `Level ${r.level}`],
    }),
  },
  map: {
    table: 'maps',
    label: 'Map',
    plural: 'Maps',
    icon: '🗺️',
    tab: 'maps',
    normalize: (r) => ({
      title: text(r.caption) || 'Untitled map',
      subtitle: r.is_world_map ? 'World Map' : '',
      body: '',
      tags: r.is_world_map ? ['World Map'] : [],
    }),
  },
  marker: {
    table: 'map_markers',
    label: 'Map pin',
    plural: 'Map pins',
    icon: '📌',
    tab: 'maps',
    normalize: (r) => ({
      title: text(r.title) || 'Untitled pin',
      subtitle: r.mapCaption ? `On ${r.mapCaption}` : '',
      body: text(r.notes),
      tags: [r.kind].filter(Boolean),
    }),
  },
  entry: {
    table: 'custom_tab_entries',
    label: 'Note',
    plural: 'Custom tabs',
    icon: '📄',
    normalize: (r) => ({
      title: text(r.title),
      subtitle: r.tabName ? `In ${r.tabName}` : '',
      body: text(r.notes),
      tags: [],
      tab: `custom:${r.custom_tab_id}`,
    }),
  },
  event: {
    label: 'Event',
    plural: 'Timeline events',
    icon: '⭐',
    tab: 'timeline',
    normalize: (r) => ({
      title: text(r.label),
      subtitle: r.sessionTitle ? `During ${r.sessionTitle}` : '',
      body: '',
      tags: [],
    }),
  },
})

export const ENTITY_TYPE_ORDER = Object.keys(ENTITY_TYPES)

function firstLine(value) {
  const line = text(value).split('\n').find((l) => l.trim()) || ''
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}

export function normalizeEntity(type, row) {
  const def = ENTITY_TYPES[type]
  const normalized = def.normalize(row)
  return {
    ...normalized,
    type,
    id: row.id,
    label: normalized.label || def.label,
    icon: def.icon,
    tab: normalized.tab || def.tab,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
    raw: row,
  }
}

export const entityKey = (type, id) => `${type}:${id}`
