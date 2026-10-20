// The tag types a session recap can reference inline (RichNotesEditor),
// keyed by group. Each group's trigger character opens a picker over one
// table; `kinds` are the tag words that can follow it (e.g. "#city"),
// saved on the created row so its card can show the same tag.
export const TAG_GROUPS = {
  person: { char: '@', tab: 'npcs', noun: 'person', icon: 'user', kinds: [] },
  place: {
    char: '#',
    tab: 'maps',
    noun: 'place',
    icon: 'pin',
    kinds: ['Location', 'City', 'Dungeon', 'Region', 'Campsite'],
  },
  lore: {
    char: '~',
    tab: 'lore',
    noun: 'lore',
    icon: 'scroll',
    kinds: ['Faction', 'Lore', 'Religion', 'History', 'Clue'],
  },
  loot: {
    char: '$',
    tab: 'loot',
    noun: 'loot',
    icon: 'coins',
    kinds: ['Item', 'Artifact', 'Magic Item'],
  },
  // "%Kraken" — a creature from the Creatures tab.
  creature: { char: '%', tab: 'creatures', noun: 'creature', icon: 'creature', kinds: [] },
  // "!event The dragon attacks" — not backed by a table: an event lives
  // only as a chip in its session's recap, and the Timeline tab reads
  // them back out of the notes (so editing the recap edits the timeline).
  event: { char: '!', tab: 'timeline', noun: 'event', icon: 'star', kinds: [], keyword: 'event' },
}

export function groupForChar(char) {
  return Object.keys(TAG_GROUPS).find((group) => TAG_GROUPS[group].char === char) || 'person'
}

export const tagSlug = (kind) => kind.trim().toLowerCase().replace(/\s+/g, '-')

// "Magic Item" in the loot group → "$magic-item".
export function tagText(group, kind) {
  return `${TAG_GROUPS[group].char}${tagSlug(kind)}`
}

// Matches a free-text value (e.g. a Lore category typed by hand) back to
// one of the group's kinds, case- and dash-insensitively, or null.
export function matchKind(group, value) {
  if (!value) return null
  const slug = tagSlug(value)
  return TAG_GROUPS[group].kinds.find((kind) => tagSlug(kind) === slug) || null
}
