import { describe, expect, it } from 'vitest'
import { emptyMechanics, emptyNarrative } from '../character.js'
import {
  IMPORT_SECTIONS,
  applyImport,
  mapDdbCharacter,
  parseCharacterId,
  parseCharacterJson,
} from '../ddbImport.js'

import { cleric } from './fixtures/ddbCleric.js'

describe('parseCharacterId', () => {
  it('accepts every common link shape and a bare ID', () => {
    expect(parseCharacterId('https://www.dndbeyond.com/characters/123456789')).toBe('123456789')
    expect(parseCharacterId('https://www.dndbeyond.com/profile/jenny/characters/123456789')).toBe('123456789')
    expect(parseCharacterId('https://ddb.ac/characters/123456789/AbCdEf')).toBe('123456789')
    expect(parseCharacterId('https://character-service.dndbeyond.com/character/v5/character/123456789')).toBe('123456789')
    expect(parseCharacterId(' 123456789 ')).toBe('123456789')
    expect(parseCharacterId('https://www.dndbeyond.com/spells/bless')).toBeNull()
  })
})

describe('parseCharacterJson', () => {
  it('unwraps the service envelope and rejects other JSON', () => {
    expect(parseCharacterJson(JSON.stringify({ success: true, data: cleric })).name).toBe('Seiya')
    expect(() => parseCharacterJson('{"foo":1}')).toThrow(/doesn’t look like/)
    expect(() => parseCharacterJson('<html>')).toThrow(/valid JSON/)
    expect(() => parseCharacterJson('{"success":false,"message":"Character is private"}')).toThrow('Character is private')
  })
})

describe('mapDdbCharacter', () => {
  const out = mapDdbCharacter(cleric)

  it('builds identity from race, class, subclass and level', () => {
    expect(out.identity).toEqual({ name: 'Seiya', raceClass: 'Aasimar Cleric (Grave Domain)', level: 3 })
  })

  it('applies racial bonuses to ability scores', () => {
    expect(out.mechanics.abilities).toEqual({ str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 15 })
  })

  it('derives HP, AC (ignoring un-attuned items), speed and slots', () => {
    expect(out.mechanics.hp).toEqual({ max: 24, current: 19, temp: 0 }) // 18 + 2×3
    expect(out.mechanics.ac).toBe(17) // scale 14 + DEX 1 + shield 2; ring not attuned
    expect(out.mechanics.speed).toBe(30)
    expect(out.mechanics.initiativeBonus).toBeNull() // just DEX
    expect(out.mechanics.spellcastingAbility).toBe('wis')
    expect(out.mechanics.spellSlots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } })
  })

  it('reads save and skill proficiencies, expertise, languages and features', () => {
    expect(out.mechanics.saves).toEqual({ wis: true, cha: true })
    expect(out.mechanics.skills).toEqual({ medicine: 1, insight: 1, religion: 2 })
    expect(out.mechanics.proficiencies).toContain('Medium Armor')
    expect(out.mechanics.proficiencies).toContain('Languages: Celestial, Common')
    expect(out.mechanics.features.split('\n')).toEqual(['Celestial Resistance', 'Spellcasting', 'Channel Divinity', 'Circle of Mortality'])
  })

  it('maps inventory, resources, spells and roleplay text', () => {
    expect(out.mechanics.inventory.map((i) => `${i.name}×${i.qty}${i.equipped ? '*' : ''}`)).toEqual([
      'Scale Mail×1*', 'Shield×1*', 'Ring of Protection×1*', 'Candle×10', 'Grandmother’s bell×1',
    ])
    expect(out.mechanics.resources.map((r) => [r.name, r.current, r.max, r.reset])).toEqual([
      ['Channel Divinity', 0, 1, 'short'],
      ['Healing Hands', 1, 1, 'long'],
    ])
    expect(out.spells.map((s) => s.name)).toEqual(['Light', 'Toll the Dead', 'Bane'])
    const bane = out.spells.find((s) => s.name === 'Bane')
    expect(bane).toMatchObject({ casting_time: '1 Action', range: '30 ft', components: 'V, S, M (a drop of blood)', duration: 'Concentration, up to 1 Minute' })
    expect(out.narrative).toMatchObject({ background: 'Acolyte', alignment: 'Neutral Good', ideals: 'Mercy', history: 'Raised in a hospice caravan.' })
    expect(out.warnings.some((w) => /AC is calculated/.test(w))).toBe(true)
  })

  it('handles multiclass spell slots with the standard table', () => {
    const multi = structuredClone(cleric)
    multi.classes.push({ level: 2, definition: { name: 'Paladin', canCastSpells: true, spellRules: { multiClassSpellSlotDivisor: 2, multiClassSpellSlotRounding: 1 } } })
    const slots = mapDdbCharacter(multi).mechanics.spellSlots
    expect(Object.fromEntries(Object.entries(slots).map(([l, s]) => [l, s.max]))).toEqual({ 1: 4, 2: 3 }) // caster level 4
  })
})

describe('applyImport', () => {
  const imported = mapDdbCharacter(cleric)
  const sheet = { mechanics: { ...emptyMechanics(), ac: 12, features: 'mine' }, narrative: { ...emptyNarrative(), ideals: 'My own ideal' } }

  it('replaces chosen mechanics and fills only empty roleplay fields', () => {
    const all = applyImport(sheet, imported, IMPORT_SECTIONS.map((s) => s.id))
    expect(all.mechanics.ac).toBe(17)
    expect(all.mechanics.abilities.wis).toBe(16)
    expect(all.narrative.ideals).toBe('My own ideal')
    expect(all.narrative.bonds).toBe('The caravan')
  })

  it('leaves unchosen sections alone', () => {
    const some = applyImport(sheet, imported, ['abilities'])
    expect(some.mechanics.ac).toBe(12)
    expect(some.mechanics.features).toBe('mine')
    expect(some.narrative.bonds).toBe('')
  })
})
