import { describe, expect, it } from 'vitest'
import { buildRelationshipWeb, neighbours, recapParagraphs } from './relationshipWeb.js'

const mention = (char, id, label) =>
  `<span data-type="mention" data-id="${id}" data-label="${label}" data-mention-suggestion-char="${char}">${char}${label}</span>`
const e = (type, id, title, raw = {}) => ({ type, id, title, raw: { id, ...raw } })

describe('relationship web', () => {
  it('splits a recap into paragraphs with their tags', () => {
    const html = `<p>We met ${mention('@', 'n1', 'Marta')} at ${mention('#', 'p1', 'Saltmere')}.</p><ul><li>Kira &amp; ${mention('~', 'l1', 'Tide Cult')}</li></ul>`
    const paras = recapParagraphs(html)
    expect(paras.map((p) => p.mentions.map((m) => m.type + m.id))).toEqual([['npcn1', 'placep1'], ['lorel1']])
    expect(paras[1].text).toBe('Kira & ~Tide Cult')
  })

  it('connects co-tagged entries, party members, links and fields', () => {
    const notes = `<p>${mention('@', 'n1', 'Marta')} told Kira about ${mention('~', 'l1', 'Tide Cult')}.</p><p>${mention('@', 'n1', 'Marta')} and ${mention('~', 'l1', 'Tide Cult')} again.</p><p>${mention('#', 'p1', 'Saltmere')}</p>`
    const entities = [
      e('session', 's1', 'Session 1', { notes }),
      e('npc', 'n1', 'Marta', { met_at: 'Saltmere' }),
      e('place', 'p1', 'Saltmere'),
      e('lore', 'l1', 'Tide Cult'),
      e('character', 'c1', 'Kira Vale'),
      e('quest', 'q1', 'Find the lighthouse', { given_by: 'marta' }),
      e('loot', 'i1', 'Sea glass', { holder: 'Kira Vale' }),
      e('npc', 'n2', 'Loner'),
    ]
    const links = [{ source_type: 'lore', source_id: 'l1', target_type: 'place', target_id: 'p1', relation: 'Based in' }]
    const web = buildRelationshipWeb(entities, links)
    const edge = (a, b) => web.edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
    expect(edge('npc:n1', 'lore:l1').weight).toBe(2)
    expect(edge('npc:n1', 'character:c1').reasons).toEqual(['Together in Session 1'])
    expect(edge('lore:l1', 'place:p1').reasons).toEqual(['Based in'])
    expect(edge('quest:q1', 'npc:n1').reasons).toEqual(['Gave the quest'])
    expect(edge('npc:n1', 'place:p1').reasons).toEqual(['Met here'])
    expect(edge('loot:i1', 'character:c1').reasons).toEqual(['Holds it'])
    expect(web.nodes.find((n) => n.key === 'npc:n2').degree).toBe(0)
    expect(neighbours(web, 'npc:n1')[0].node.label).toBe('Tide Cult')
  })
})
