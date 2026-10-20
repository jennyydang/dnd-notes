// The relationship web: who and what is connected to what, built from
// what the party has already written down —
//  • tags that share a paragraph of a session recap (@person, #place,
//    ~lore, $loot, %creature), and party members named in that paragraph;
//  • explicit links between entries ("met at", "clue for"…);
//  • a quest's "given by", an NPC's "met at", an item's holder.

export const WEB_TYPES = {
  character: { label: 'Party', color: '#e3c26b' },
  npc: { label: 'NPCs', color: '#d98b5f' },
  place: { label: 'Places', color: '#6fae8f' },
  lore: { label: 'Lore & factions', color: '#9b8fd6' },
  quest: { label: 'Quests', color: '#d0708f' },
  loot: { label: 'Loot', color: '#7fb3c8' },
  creature: { label: 'Creatures', color: '#c9625e' },
  goal: { label: 'Party goals', color: '#8fc46b' },
}

// The hub every party member (and party goal) hangs off, so the party
// reads as one group in the web.
export const PARTY_HUB = 'party:hub'

const MENTION_TYPE = { '@': 'npc', '#': 'place', '~': 'lore', $: 'loot', '%': 'creature' }

const decode = (s) =>
  String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)
  return m ? decode(m[1]) : null
}

// A recap's paragraphs (and list items, headings), each with the tags in
// it and its plain text. Works on the editor's HTML without a DOM.
export function recapParagraphs(html) {
  if (!html || !/^\s*</.test(html)) {
    return String(html || '')
      .split(/\n\s*\n/)
      .map((text) => ({ mentions: [], tags: [], text }))
  }
  return html
    .split(/<\/(?:p|li|h[1-6]|blockquote)>/i)
    .map((chunk) => {
      const mentions = []
      // Every tag, in order (events too): { char, id, label }.
      const tags = []
      for (const m of chunk.matchAll(/<span\b[^>]*data-type="mention"[^>]*>/gi)) {
        const char = attr(m[0], 'data-mention-suggestion-char')
        const type = MENTION_TYPE[char]
        const id = attr(m[0], 'data-id')
        if (type && id) mentions.push({ type, id })
        if (char && id) tags.push({ char, id, label: attr(m[0], 'data-label') || '' })
      }
      const text = decode(chunk.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
      return { mentions, tags, text: text.replace(/\s+/g, ' ').trim() }
    })
    .filter((p) => p.tags.length || p.text)
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .trim()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Matches a party member's name (or first name) in free text.
function nameMatcher(name) {
  const full = String(name || '').trim()
  if (full.length < 3) return null
  const first = full.split(/\s+/)[0]
  const words = [...new Set([full, first.length >= 3 ? first : null].filter(Boolean))]
  return new RegExp(`\\b(?:${words.map(escapeRe).join('|')})\\b`, 'i')
}

// { nodes: [{ key, type, id, label, entity, degree }], edges: [{ a, b, weight, reasons: [] }] }
// from the campaign index's entities and entity_links rows.
export function buildRelationshipWeb(entities, links = []) {
  const nodes = new Map()
  for (const e of entities) {
    if (!WEB_TYPES[e.type]) continue
    nodes.set(`${e.type}:${e.id}`, { key: `${e.type}:${e.id}`, type: e.type, id: e.id, label: e.title || e.label, entity: e, degree: 0 })
  }
  const members = [...nodes.values()].filter((n) => n.type === 'character')
  if (members.length) {
    nodes.set(PARTY_HUB, {
      key: PARTY_HUB,
      type: 'character',
      id: null,
      hub: true,
      label: 'The Party',
      entity: { type: 'character', label: 'Party', title: 'The Party', raw: {} },
      degree: 0,
    })
  }
  const edges = new Map()
  function connect(ka, kb, reason) {
    if (ka === kb || !nodes.has(ka) || !nodes.has(kb)) return
    const [a, b] = ka < kb ? [ka, kb] : [kb, ka]
    const id = `${a}|${b}`
    let edge = edges.get(id)
    if (!edge) edges.set(id, (edge = { id, a, b, weight: 0, reasons: [] }))
    edge.weight += 1
    if (!edge.reasons.includes(reason)) edge.reasons.push(reason)
  }

  const byName = (type) => {
    const map = new Map()
    for (const n of nodes.values()) if (n.type === type && n.label) map.set(norm(n.label), n.key)
    return map
  }
  const npcByName = byName('npc')
  const placeByName = byName('place')
  const charByName = byName('character')
  for (const m of members) connect(m.key, PARTY_HUB, 'Party member')
  for (const n of nodes.values()) if (n.type === 'goal') connect(n.key, PARTY_HUB, 'Party goal')

  const party = members
    .map((n) => ({ key: n.key, re: nameMatcher(n.label) }))
    .filter((p) => p.re)

  // Tags sharing a paragraph of a recap.
  for (const session of entities.filter((e) => e.type === 'session')) {
    const title = session.title || 'a session'
    for (const p of recapParagraphs(session.raw?.notes)) {
      const keys = [...new Set(p.mentions.map((m) => `${m.type}:${m.id}`))].filter((k) => nodes.has(k))
      if (!keys.length) continue
      for (const member of party) if (member.re.test(p.text)) keys.push(member.key)
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) connect(keys[i], keys[j], `Together in ${title}`)
      }
    }
  }

  for (const link of links) {
    connect(`${link.source_type}:${link.source_id}`, `${link.target_type}:${link.target_id}`, link.relation || 'Linked')
  }

  for (const n of nodes.values()) {
    const raw = n.entity.raw || {}
    if (n.type === 'quest' && raw.given_by) {
      const giver = npcByName.get(norm(raw.given_by)) || charByName.get(norm(raw.given_by))
      if (giver) connect(n.key, giver, 'Gave the quest')
    }
    if (n.type === 'npc' && raw.met_at) {
      const place = placeByName.get(norm(raw.met_at))
      if (place) connect(n.key, place, 'Met here')
    }
    if (n.type === 'loot' && raw.holder) {
      const holder = charByName.get(norm(raw.holder)) || npcByName.get(norm(raw.holder))
      if (holder) connect(n.key, holder, 'Holds it')
    }
  }

  const edgeList = [...edges.values()]
  for (const e of edgeList) {
    nodes.get(e.a).degree += 1
    nodes.get(e.b).degree += 1
  }
  return { nodes: [...nodes.values()], edges: edgeList }
}

// A node's neighbours, strongest connection first.
export function neighbours(web, key) {
  return web.edges
    .filter((e) => e.a === key || e.b === key)
    .map((e) => ({ edge: e, node: web.nodes.find((n) => n.key === (e.a === key ? e.b : e.a)) }))
    .filter((x) => x.node)
    .sort((x, y) => y.edge.weight - x.edge.weight || x.node.label.localeCompare(y.node.label))
}
