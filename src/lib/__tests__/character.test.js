import { describe, expect, it } from 'vitest'
import {
  SKILLS,
  abilityModifier,
  applyHpChange,
  emptyMechanics,
  initiativeBonus,
  normalizeSheet,
  passivePerception,
  proficiencyBonus,
  saveBonus,
  skillBonus,
} from '../character.js'

describe('abilityModifier', () => {
  it('follows the (score - 10) / 2 rounded down rule', () => {
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(9)).toBe(-1)
    expect(abilityModifier(16)).toBe(3)
    expect(abilityModifier(1)).toBe(-5)
  })
  it('is unknown for a blank score', () => {
    expect(abilityModifier(null)).toBeNull()
    expect(abilityModifier('')).toBeNull()
  })
})

describe('proficiencyBonus', () => {
  it('scales with level', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 3, 4, 5, 6, 6])
  })
})

describe('derived bonuses', () => {
  const m = emptyMechanics()
  m.abilities.wis = 16
  m.abilities.dex = 12
  m.skills.perception = 1
  m.skills.insight = 2
  m.saves.wis = true
  const skill = (id) => SKILLS.find((s) => s.id === id)

  it('adds proficiency and expertise to skills', () => {
    expect(skillBonus(m, skill('perception'), 5)).toBe(3 + 3)
    expect(skillBonus(m, skill('insight'), 5)).toBe(3 + 6)
    expect(skillBonus(m, skill('athletics'), 5)).toBeNull() // no STR entered
  })

  it('computes saves, initiative and passive perception', () => {
    expect(saveBonus(m, 'wis', 1)).toBe(5)
    expect(saveBonus(m, 'dex', 1)).toBe(1)
    expect(initiativeBonus(m)).toBe(1)
    expect(initiativeBonus({ ...m, initiativeBonus: 4 })).toBe(4)
    expect(passivePerception(m, 1)).toBe(15)
  })
})

describe('applyHpChange', () => {
  it('spends temporary HP before current HP and never goes below 0', () => {
    expect(applyHpChange({ current: 10, max: 20, temp: 5 }, -8)).toEqual({ current: 7, max: 20, temp: 0 })
    expect(applyHpChange({ current: 3, max: 20, temp: 0 }, -10)).toEqual({ current: 0, max: 20, temp: 0 })
  })
  it('heals up to max', () => {
    expect(applyHpChange({ current: 15, max: 20, temp: 0 }, 10).current).toBe(20)
  })
})

describe('normalizeSheet', () => {
  it('fills missing fields without overwriting saved ones', () => {
    const sheet = normalizeSheet({ mechanics: { ac: 16, hp: { max: 30 } }, narrative: { ideals: 'Mercy' } })
    expect(sheet.mechanics.ac).toBe(16)
    expect(sheet.mechanics.hp).toEqual({ current: null, max: 30, temp: 0 })
    expect(sheet.mechanics.abilities.str).toBeNull()
    expect(sheet.narrative.ideals).toBe('Mercy')
    expect(sheet.narrative.quirks).toEqual([])
  })
})
