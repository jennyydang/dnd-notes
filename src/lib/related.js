import { extractMentions } from './richNotes.js'
import { entityKey } from './entities.js'

// Session-note tag groups (lib/tags.js) → entity types. Events have no
// row of their own, so they aren't linkable entries.
const MENTION_TYPES = { person: 'npc', place: 'place', lore: 'lore', loot: 'loot' }

// Resolves a mention to an entity. Falls back to searching every type by
// id, since older "#" tags pointed at Lore entries before Places existed.
function resolveMention(group, id, byKey, entities) {
  const type = MENTION_TYPES[group]
  if (!type) return null
  return byKey.get(entityKey(type, id)) || entities.find((e) => e.id === id) || null
}

// Everything related to `entity`, from two sources:
//  - explicit links (entity_links rows), in either direction, including
//    links to entries that have since been deleted (entity: null);
//  - implicit links from session notes: a session is related to every
//    entry tagged in its recap, and an entry to every session tagging it.
// Returns [{ key, entity, relation, linkId, source: 'link' | 'mention', missingType }].
export function relatedEntries(entity, { links, entities, byKey }) {
  if (!entity) return []
  const seen = new Set()
  const results = []
  const push = (item) => {
    const key = item.entity ? entityKey(item.entity.type, item.entity.id) : `missing:${item.linkId}`
    if (seen.has(key) && item.source === 'mention') return
    seen.add(key)
    results.push({ key, ...item })
  }

  for (const link of links) {
    let otherType
    let otherId
    if (link.source_type === entity.type && link.source_id === entity.id) {
      otherType = link.target_type
      otherId = link.target_id
    } else if (link.target_type === entity.type && link.target_id === entity.id) {
      otherType = link.source_type
      otherId = link.source_id
    } else {
      continue
    }
    push({
      entity: byKey.get(entityKey(otherType, otherId)) || null,
      missingType: otherType,
      relation: link.relation,
      linkId: link.id,
      source: 'link',
    })
  }

  if (entity.type === 'session') {
    const mentions = extractMentions(entity.raw.notes)
    for (const [group, list] of Object.entries(mentions)) {
      for (const mention of list) {
        const target = resolveMention(group, mention.id, byKey, entities)
        if (target) push({ entity: target, relation: 'mentioned in this session', source: 'mention' })
      }
    }
  } else {
    for (const session of entities) {
      if (session.type !== 'session') continue
      const notes = session.raw.notes || ''
      if (!notes.includes(entity.id)) continue // cheap pre-check before parsing
      const mentions = extractMentions(notes)
      const hit = Object.values(mentions).some((list) => list.some((m) => m.id === entity.id))
      if (hit) push({ entity: session, relation: 'mentioned in session', source: 'mention' })
    }
  }

  return results
}

// Entities tagged in the given sessions' recaps, de-duplicated, most
// recent session first — used by Prep to surface "who and where came up
// lately".
export function mentionedIn(sessions, { entities, byKey }) {
  const seen = new Set()
  const found = []
  for (const session of sessions) {
    const mentions = extractMentions(session.raw.notes)
    for (const [group, list] of Object.entries(mentions)) {
      for (const mention of list) {
        const target = resolveMention(group, mention.id, byKey, entities)
        if (!target) continue
        const key = entityKey(target.type, target.id)
        if (seen.has(key)) continue
        seen.add(key)
        found.push(target)
      }
    }
  }
  return found
}
