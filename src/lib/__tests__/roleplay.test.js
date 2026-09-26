import { describe, expect, it } from 'vitest'
import { emptyNarrative } from '../character.js'
import { buildAssistantPrompt, isAssistantConfigured, matchingQuirks, parseSuggestions } from '../roleplayAssistant.js'
import { applyGuide, looksLikeSeiya, seiyaGuide } from '../seiya.js'

describe('seiya guide', () => {
  it('recognises the character by name', () => {
    expect(looksLikeSeiya('Seiya')).toBe(true)
    expect(looksLikeSeiya('Seiya of the Caravan')).toBe(true)
    expect(looksLikeSeiya('Seiyan')).toBe(false)
  })

  it('only fills blank fields and never duplicates list entries', () => {
    const narrative = { ...emptyNarrative(), publicPersona: 'My own words', voiceExamples: ['Yeah… that probably won’t end well.'] }
    const merged = applyGuide(narrative, seiyaGuide())
    expect(merged.publicPersona).toBe('My own words')
    expect(merged.privateThoughts).toMatch(/life and death/)
    expect(merged.voiceExamples).toHaveLength(4)
    const again = applyGuide(merged, seiyaGuide())
    expect(again.quirks).toHaveLength(merged.quirks.length)
  })

  it('does not invent relationships, ideals or bonds', () => {
    const merged = applyGuide(emptyNarrative(), seiyaGuide())
    expect(merged.relationships).toEqual([])
    expect(merged.ideals).toBe('')
    expect(merged.bonds).toBe('')
  })
})

describe('roleplay assistant', () => {
  const character = { name: 'Seiya', race_class: 'Aasimar Cleric', level: 3 }
  const narrative = applyGuide(emptyNarrative(), seiyaGuide())

  it('is not configured without an endpoint', () => {
    expect(isAssistantConfigured()).toBe(false)
  })

  it('builds a prompt from recorded facts only, with tones and output shape', () => {
    const prompt = buildAssistantPrompt({ character, narrative, scene: 'A soldier is dying in the mud.', tones: ['dry', 'gentle'] })
    expect(prompt).toContain('Seiya')
    expect(prompt).toContain('A soldier is dying in the mud.')
    expect(prompt).toContain('Dry, Gentle')
    expect(prompt).toContain('do not invent')
    expect(prompt).toContain('"dialogue"')
    expect(prompt).not.toContain('Relationships:')
  })

  it('parses and validates suggestions', () => {
    const parsed = parseSuggestions({ suggestions: [{ tone: 'dry', dialogue: 'Hi' }, { tone: 'x' }, null] })
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ tone: 'dry', dialogue: 'Hi', action: '', thought: '' })
    expect(() => parseSuggestions({})).toThrow()
  })

  it('surfaces quirks whose context fits the scene', () => {
    const hits = matchingQuirks(narrative.quirks, 'The goblin is dying and says something')
    expect(hits.map((q) => q.text)).toContain('Listens intensely to last words')
  })
})
