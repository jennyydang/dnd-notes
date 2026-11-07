import { indexLetter } from './wiki.js'

// The world's dictionary: its own words (invented vocabulary, titles,
// phrases) and how to say the names in it.

export const TERM_KINDS = ['Word', 'Name', 'Place name', 'Title', 'Phrase', 'Oath or curse', 'Magic word', 'Slang', 'Other']

export const LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
  'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan',
  'Undercommon', 'Druidic', 'Thieves’ Cant',
]

// Entries whose names are worth a pronunciation, and the kind they'd get.
const NAME_KINDS = { npc: 'Name', character: 'Name', creature: 'Name', place: 'Place name', lore: 'Word' }

export const termFromRow = (r) => ({
  id: r.id,
  term: r.term || '',
  pronunciation: r.pronunciation || '',
  kind: r.kind || 'Word',
  language: r.language || '',
  meaning: r.meaning || '',
  notes: r.notes || '',
  createdAt: r.created_at,
})

const fold = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// Alphabetical, accents ignored (Ærenwë files under A).
export function sortTerms(terms) {
  return [...terms].sort((a, b) => fold(a.term).localeCompare(fold(b.term)) || a.term.localeCompare(b.term))
}

// [{ letter, terms }] in A–Z order, '#' last for anything not a letter.
export function groupByLetter(terms) {
  const groups = new Map()
  for (const t of sortTerms(terms)) {
    const letter = indexLetter(fold(t.term)) === '#' ? '#' : indexLetter(fold(t.term))
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter).push(t)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#') - (b === '#') || a.localeCompare(b))
    .map(([letter, list]) => ({ letter, terms: list }))
}

export function matchesTerm(t, query) {
  const q = fold(query)
  if (!q) return true
  return [t.term, t.pronunciation, t.meaning, t.notes, t.language, t.kind].some((v) => fold(v).includes(q))
}

// Names in the world that the dictionary doesn't have yet.
export function missingNames(entities, terms, limit = 12) {
  const have = new Set(terms.map((t) => fold(t.term)))
  const seen = new Set()
  const out = []
  for (const e of entities) {
    const kind = NAME_KINDS[e.type]
    const name = (e.title || '').trim()
    if (!kind || !name || name.length > 40 || have.has(fold(name)) || seen.has(fold(name))) continue
    seen.add(fold(name))
    out.push({ entity: e, kind, name })
    if (out.length >= limit) break
  }
  return out
}

// The whole dictionary as Markdown, for downloading or pasting.
export function dictionaryMarkdown(terms, title = 'Dictionary') {
  const lines = [`# ${title}`, '']
  for (const { letter, terms: list } of groupByLetter(terms)) {
    lines.push(`## ${letter}`, '')
    for (const t of list) {
      const facts = [t.pronunciation && `/${t.pronunciation}/`, t.kind, t.language].filter(Boolean).join(' · ')
      lines.push(`**${t.term}**${facts ? ` — ${facts}` : ''}  `)
      if (t.meaning) lines.push(`${t.meaning}  `)
      if (t.notes) lines.push(`*${t.notes}*`)
      lines.push('')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}
