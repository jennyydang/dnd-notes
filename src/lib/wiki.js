import { groupForChar } from './tags.js'
import { sessionDateTimestamp } from './sessionNotes.js'
import { entityKey } from './entities.js'

// The World Wiki: one article per thing the party has written about —
// NPCs, places, lore, items, creatures, quests — with where it was noted:
// every session recap and quick note that tags it (or names it), in the
// order they happened, with the lines around it.

export const WIKI_TYPES = ['npc', 'place', 'lore', 'loot', 'creature', 'quest']
const MENTION_TYPES = { person: 'npc', place: 'place', lore: 'lore', loot: 'loot', creature: 'creature' }
const SNIPPET = 240
const SNIPPETS_PER_SOURCE = 3

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTITIES[e])
const stripTags = (html) => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null

// A recap's paragraphs (and list items) as raw HTML. Plain-text recaps
// from before the rich editor are split into lines.
function blocksOf(notes) {
  if (!notes) return []
  if (!notes.trimStart().startsWith('<')) return notes.split('\n').filter((l) => l.trim())
  // Paragraphs and headings, plus list items that hold their text
  // directly (an item's text usually sits in its own <p>), in order.
  const found = [...notes.matchAll(/<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ at: m.index, html: m[2] }))
  for (const m of notes.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    if (!/<p\b/i.test(m[1])) found.push({ at: m.index, html: m[1] })
  }
  const blocks = found.sort((a, b) => a.at - b.at).map((b) => b.html)
  return blocks
}

// Tagged mentions in a block of recap HTML: [{ group, id, label }].
function tagsIn(blockHtml) {
  const found = []
  for (const [tag] of blockHtml.matchAll(/<span\b[^>]*data-type="mention"[^>]*>/gi)) {
    const id = attr(tag, 'data-id')
    if (id) found.push({ group: groupForChar(attr(tag, 'data-mention-suggestion-char')), id, label: decode(attr(tag, 'data-label') || '') })
  }
  return found
}

// Quick-note tag tokens: {{tag:@|id|kind|label}}.
const NOTE_TOKEN = /\{\{tag:([@#~$%!])\|([^|}]*)\|([^|}]*)\|([^}]*)\}\}/g
function noteBlocks(content) {
  return String(content || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => ({
      text: line.replace(NOTE_TOKEN, (_, _c, _id, _k, label) => label).replace(/\s+/g, ' ').trim(),
      tags: [...line.matchAll(NOTE_TOKEN)].map((m) => ({ group: groupForChar(m[1]), id: m[2], label: m[4] })),
    }))
}

// The text around the first `term`, cut to a readable length.
export function snippetAround(text, terms) {
  if (text.length <= SNIPPET) return text
  const at = Math.max(0, ...terms.map((t) => text.indexOf(t)).filter((i) => i >= 0).slice(0, 1))
  const start = Math.max(0, Math.min(at - SNIPPET / 3, text.length - SNIPPET))
  const cut = text.slice(start, start + SNIPPET)
  return `${start > 0 ? '…' : ''}${cut.trim()}${start + SNIPPET < text.length ? '…' : ''}`
}

const sourceDate = (e) => (e.type === 'session' ? sessionDateTimestamp(e.raw.session_date) || Date.parse(e.createdAt) : Date.parse(e.createdAt)) || 0

// entities (CampaignDataProvider's) → { articles, byKey }. Each article:
// { key, entity, notedIn: [{ source, date, snippets, tagged }],
//   alongside: [{ key, count }] } — sources oldest first.
export function buildWiki(entities) {
  const articles = new Map()
  const byId = new Map()
  for (const e of entities) {
    if (!WIKI_TYPES.includes(e.type)) continue
    const key = entityKey(e.type, e.id)
    articles.set(key, { key, entity: e, notedIn: [], alongside: new Map() })
    byId.set(e.id, key)
  }
  // Names long enough to find untagged ("Forren said…") without noise.
  const named = [...articles.values()]
    .map((a) => ({ key: a.key, name: a.entity.title?.trim() }))
    .filter((n) => n.name && n.name.length >= 4)
    .map((n) => ({ ...n, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n.name)}(?=$|[^\\p{L}\\p{N}])`, 'u') }))

  const sources = entities
    .filter((e) => e.type === 'session' || e.type === 'note')
    .sort((a, b) => sourceDate(a) - sourceDate(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt))

  for (const source of sources) {
    const blocks =
      source.type === 'session'
        ? blocksOf(source.raw.notes).map((html) => ({ text: stripTags(html), tags: tagsIn(html) }))
        : noteBlocks(source.raw.content)
    const hits = new Map() // article key → { snippets, tagged, terms }
    for (const block of blocks) {
      if (!block.text) continue
      const inBlock = new Map()
      for (const t of block.tags) {
        const type = MENTION_TYPES[t.group]
        const key = (type && articles.has(entityKey(type, t.id)) && entityKey(type, t.id)) || byId.get(t.id)
        if (key) inBlock.set(key, { tagged: true, term: t.label })
      }
      for (const n of named) {
        if (!inBlock.has(n.key) && block.text.includes(n.name) && n.re.test(block.text)) inBlock.set(n.key, { tagged: false, term: n.name })
      }
      for (const [key, { tagged, term }] of inBlock) {
        const hit = hits.get(key) || { snippets: [], tagged: false }
        hit.tagged ||= tagged
        if (hit.snippets.length < SNIPPETS_PER_SOURCE) hit.snippets.push(snippetAround(block.text, [term]))
        hits.set(key, hit)
        for (const other of inBlock.keys()) {
          if (other === key) continue
          const along = articles.get(key).alongside
          along.set(other, (along.get(other) || 0) + 1)
        }
      }
    }
    for (const [key, hit] of hits) {
      articles.get(key).notedIn.push({ source, date: sourceDate(source), snippets: hit.snippets, tagged: hit.tagged })
    }
  }

  const list = [...articles.values()]
    .map((a) => ({
      ...a,
      alongside: [...a.alongside.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 8)
        .map(([key, count]) => ({ key, count })),
    }))
    .sort((a, b) => (a.entity.title || '').localeCompare(b.entity.title || '', undefined, { sensitivity: 'base' }))
  return { articles: list, byKey: new Map(list.map((a) => [a.key, a])) }
}

// "A"…"Z", or "#" for anything starting with a digit or symbol.
export const indexLetter = (title) => {
  const c = (title || '').trim().charAt(0).toUpperCase()
  return /\p{L}/u.test(c) ? c : '#'
}
