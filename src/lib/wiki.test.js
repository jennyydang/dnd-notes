import { describe, expect, it } from 'vitest'
import { buildWiki, indexLetter, snippetAround } from './wiki.js'

const ent = (type, id, title, raw = {}, createdAt = '2026-09-01T00:00:00Z') => ({ type, id, title, raw: { id, ...raw }, createdAt })
const tag = (c, id, label) => `<span data-type="mention" data-id="${id}" data-label="${label}" data-mention-suggestion-char="${c}">${c}${label}</span>`

const entities = [
  ent('npc', 'n1', 'Forren'),
  ent('npc', 'n2', 'Ziva'),
  ent('place', 'p1', 'Ferelia’s brothel'),
  ent('loot', 'l1', 'Abyssal Shark Ash'),
  ent('quest', 'q1', 'Find the Guild'),
  ent('session', 's9', 'Session 9: The Brothel', {
    session_date: '2026-10-16',
    notes: `<p>We met ${tag('@', 'n1', 'Forren')} at ${tag('#', 'p1', 'Ferelia’s brothel')}.</p><ul><li><p>Ziva held the ${tag('$', 'l1', 'Abyssal Shark Ash')} &amp; it vanished.</p></li></ul>`,
  }),
  ent('session', 's3', 'Session 3', { session_date: '2026-09-20', notes: '<p>Forren first appeared, asking about the Guild.</p>' }),
  ent('note', 'qn1', 'note', { content: 'Ask {{tag:@|n2|NPC|Ziva}} about the ash' }, '2026-10-17T00:00:00Z'),
]

describe('world wiki', () => {
  const { articles, byKey } = buildWiki(entities)

  it('has an article per NPC, place, item, lore, creature and quest — A to Z', () => {
    expect(articles.map((a) => a.entity.title)).toEqual(['Abyssal Shark Ash', 'Ferelia’s brothel', 'Find the Guild', 'Forren', 'Ziva'])
  })

  it('lists every session that notes it, oldest first, tagged or by name', () => {
    const forren = byKey.get('npc:n1')
    expect(forren.notedIn.map((n) => n.source.id)).toEqual(['s3', 's9'])
    expect(forren.notedIn[0]).toMatchObject({ tagged: false, snippets: ['Forren first appeared, asking about the Guild.'] })
    expect(forren.notedIn[1]).toMatchObject({ tagged: true, snippets: ['We met @Forren at #Ferelia’s brothel.'] })
  })

  it('reads list items and quick notes, decoding entities', () => {
    const ash = byKey.get('loot:l1')
    expect(ash.notedIn[0].snippets[0]).toBe('Ziva held the $Abyssal Shark Ash & it vanished.')
    const ziva = byKey.get('npc:n2')
    expect(ziva.notedIn.map((n) => n.source.id)).toEqual(['s9', 'qn1'])
    expect(ziva.notedIn[1].snippets[0]).toBe('Ask Ziva about the ash')
  })

  it('remembers what came up together', () => {
    expect(byKey.get('npc:n1').alongside).toEqual([{ key: 'place:p1', count: 1 }])
  })

  it('does not match short or partial names', () => {
    expect(byKey.get('quest:q1').notedIn).toEqual([])
  })

  it('cuts long paragraphs around the mention', () => {
    const long = `${'a '.repeat(200)}Forren ${'b '.repeat(200)}`
    const s = snippetAround(long, ['Forren'])
    expect(s.length).toBeLessThan(260)
    expect(s).toContain('Forren')
    expect(s.startsWith('…') && s.endsWith('…')).toBe(true)
  })

  it('indexes by first letter', () => {
    expect(indexLetter('ziva')).toBe('Z')
    expect(indexLetter('3 Sisters')).toBe('#')
  })
})
