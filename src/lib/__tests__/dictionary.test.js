import { describe, expect, it } from 'vitest'
import { dictionaryMarkdown, groupByLetter, matchesTerm, missingNames, sortTerms } from '../dictionary.js'

const t = (term, extra = {}) => ({ id: term, term, pronunciation: '', kind: 'Word', language: '', meaning: '', notes: '', ...extra })

describe('dictionary', () => {
  it('sorts A–Z ignoring accents and case', () => {
    expect(sortTerms([t('vistani'), t('Ærenwë'), t('Barovia')]).map((x) => x.term)).toEqual(['Ærenwë', 'Barovia', 'vistani'])
  })
  it('groups by first letter with symbols last', () => {
    const groups = groupByLetter([t('Strahd'), t('"Saint" Markovia'), t('Ireena'), t('Svalich')])
    expect(groups.map((g) => g.letter)).toEqual(['I', 'S', '#'])
    expect(groups[1].terms.map((x) => x.term)).toEqual(['Strahd', 'Svalich'])
  })
  it('searches spelling, pronunciation and meaning', () => {
    const word = t('Dusk elf', { pronunciation: 'dusk-ELF', meaning: 'An elf of the Vistani lands' })
    expect(matchesTerm(word, 'vistani')).toBe(true)
    expect(matchesTerm(word, 'ELF')).toBe(true)
    expect(matchesTerm(word, 'dragon')).toBe(false)
  })
  it('suggests names the dictionary is missing', () => {
    const entities = [
      { type: 'npc', id: '1', title: 'Ireena Kolyana' },
      { type: 'place', id: '2', title: 'Vallaki' },
      { type: 'quest', id: '3', title: 'Find the abbot' },
      { type: 'npc', id: '4', title: 'Strahd' },
    ]
    expect(missingNames(entities, [t('strahd')]).map((m) => [m.name, m.kind])).toEqual([
      ['Ireena Kolyana', 'Name'],
      ['Vallaki', 'Place name'],
    ])
  })
  it('writes Markdown', () => {
    const md = dictionaryMarkdown([t('Strahd', { pronunciation: 'STRAHD', kind: 'Name', meaning: 'The vampire lord' })], 'Barovia')
    expect(md).toBe('# Barovia\n\n## S\n\n**Strahd** — /STRAHD/ · Name  \nThe vampire lord\n')
  })
})
