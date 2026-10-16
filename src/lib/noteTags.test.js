import { describe, expect, it } from 'vitest'
import { recapParagraphs } from './relationshipWeb.js'
import { noteTagsToPlain, noteToRecapHtml, plainToNoteTags, splitNoteTags, tagToken } from './noteTags.js'

const marta = tagToken({ char: '@', id: 'n1', label: 'Old Marta' })
const map = tagToken({ char: '#', id: 'm1', label: 'Sea | chart {old}' })

describe('note tags', () => {
  it('splits, flattens and cleans labels', () => {
    const note = `Met ${marta} near ${map}.`
    expect(splitNoteTags(note).map((p) => p.text ?? p.tag.label)).toEqual(['Met ', 'Old Marta', ' near ', 'Sea chart old', '.'])
    expect(noteTagsToPlain(note)).toBe('Met @Old Marta near #Sea chart old.')
  })

  it('keeps the tags a player left in while editing', () => {
    const note = `Met ${marta} near ${map}.`
    const edited = 'Met @Old Marta again. Lost the map.'
    expect(plainToNoteTags(edited, note)).toBe(`Met ${marta} again. Lost the map.`)
  })

  it('becomes real recap tags', () => {
    const html = `<p>${noteToRecapHtml(`Met ${marta} & <b>`)}</p>`
    expect(html).toContain('&amp; &lt;b&gt;')
    expect(recapParagraphs(html)[0].mentions).toEqual([{ type: 'npc', id: 'n1' }])
    expect(html).toContain('data-label="Old Marta"')
  })
})
