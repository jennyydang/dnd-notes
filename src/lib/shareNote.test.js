import { describe, expect, it } from 'vitest'
import { shareNote } from './dmShares.js'
import { noteTagsToPlain, splitNoteTags } from './noteTags.js'

const tagOf = (note) => splitNoteTags(note).find((p) => p.tag).tag

describe('share notes', () => {
  it('tags each kind of share', () => {
    const npc = shareNote({ id: 's1', kind: 'npc', title: 'Marta', payload: { name: 'Old Marta' } }, 'n1')
    expect(noteTagsToPlain(npc)).toBe('Met @Old Marta — shared by the DM.')
    expect(tagOf(npc)).toMatchObject({ char: '@', id: 'n1' })

    const map = shareNote({ id: 's2', kind: 'map', title: 'x', payload: { caption: 'Sea chart' } }, 'm1')
    expect(noteTagsToPlain(map)).toBe('Got a map: #Sea chart — shared by the DM.')

    const monster = shareNote({ id: 's3', kind: 'creature', title: 'Kraken', payload: { name: 'Kraken' } }, 'c1')
    expect(noteTagsToPlain(monster)).toBe('Encountered %Kraken — shared by the DM.')
    expect(tagOf(monster)).toMatchObject({ char: '%', id: 'c1' })

    const art = shareNote({ id: 's4', kind: 'art', title: 'The burning keep', payload: {} }, 'a1')
    expect(noteTagsToPlain(art)).toBe('!Saw The burning keep — shared by the DM.')
  })
})
