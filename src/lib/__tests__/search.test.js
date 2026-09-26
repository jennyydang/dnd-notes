import { describe, expect, it } from 'vitest'
import { normalizeText, searchEntities, snippet, withinOneEdit } from '../search.js'

const entries = [
  { type: 'npc', id: '1', title: 'Elandra Voss', subtitle: 'Half-elf', body: 'Runs the Rusty Tankard', tags: ['Alive'], createdAt: '2026-01-01' },
  { type: 'place', id: '2', title: 'Rusty Tankard', subtitle: 'Location', body: 'Tavern in Waterdeep', tags: ['Location'], createdAt: '2026-02-01' },
  { type: 'quest', id: '3', title: 'Find the Sunken Crypt', subtitle: 'Active', body: 'Elandra mentioned it', tags: ['Active'], createdAt: '2026-03-01' },
]

describe('normalizeText', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeText("  Élandra's  Tankard! ")).toBe('elandra s tankard')
  })
})

describe('withinOneEdit', () => {
  it('accepts one substitution, insertion, deletion or transposition', () => {
    expect(withinOneEdit('elandra', 'elandro')).toBe(true)
    expect(withinOneEdit('elandra', 'elndra')).toBe(true)
    expect(withinOneEdit('elandra', 'elanddra')).toBe(true)
    expect(withinOneEdit('elandra', 'elnadra')).toBe(true)
    expect(withinOneEdit('elandra', 'eladnro')).toBe(false)
  })
})

describe('searchEntities', () => {
  it('ranks title matches above body matches', () => {
    const results = searchEntities(entries, 'elandra')
    expect(results.map((r) => r.id)).toEqual(['1', '3'])
  })

  it('requires every word to match somewhere', () => {
    expect(searchEntities(entries, 'rusty waterdeep').map((r) => r.id)).toEqual(['2'])
    expect(searchEntities(entries, 'rusty dragon')).toEqual([])
  })

  it('forgives a typo in a title word', () => {
    expect(searchEntities(entries, 'elandro').map((r) => r.id)).toEqual(['1'])
  })

  it('matches prefixes', () => {
    expect(searchEntities(entries, 'sunk').map((r) => r.id)).toEqual(['3'])
  })

  it('filters by type and returns everything for an empty query', () => {
    expect(searchEntities(entries, '', { types: ['place', 'quest'] }).map((r) => r.id)).toEqual(['3', '2'])
  })

  it('sorts alphabetically on request', () => {
    expect(searchEntities(entries, '', { sort: 'alpha' }).map((r) => r.title)).toEqual([
      'Elandra Voss',
      'Find the Sunken Crypt',
      'Rusty Tankard',
    ])
  })
})

describe('snippet', () => {
  it('centres on the first matching word', () => {
    const body = `${'x '.repeat(100)}the dragon woke ${'y '.repeat(100)}`
    const s = snippet(body, 'dragon', 40)
    expect(s).toContain('dragon')
    expect(s.startsWith('…')).toBe(true)
  })
})
