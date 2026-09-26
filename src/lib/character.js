// Character-sheet shape and the 5e rules the sheet derives values from.
// Nothing here invents a character's numbers: every stat starts empty
// (null) and derived values (modifiers, proficiency bonus, skill totals)
// are only computed from what the player has entered.

export const ABILITIES = [
  { id: 'str', label: 'Strength', short: 'STR' },
  { id: 'dex', label: 'Dexterity', short: 'DEX' },
  { id: 'con', label: 'Constitution', short: 'CON' },
  { id: 'int', label: 'Intelligence', short: 'INT' },
  { id: 'wis', label: 'Wisdom', short: 'WIS' },
  { id: 'cha', label: 'Charisma', short: 'CHA' },
]

export const SKILLS = [
  { id: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { id: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', label: 'Arcana', ability: 'int' },
  { id: 'athletics', label: 'Athletics', ability: 'str' },
  { id: 'deception', label: 'Deception', ability: 'cha' },
  { id: 'history', label: 'History', ability: 'int' },
  { id: 'insight', label: 'Insight', ability: 'wis' },
  { id: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { id: 'investigation', label: 'Investigation', ability: 'int' },
  { id: 'medicine', label: 'Medicine', ability: 'wis' },
  { id: 'nature', label: 'Nature', ability: 'int' },
  { id: 'perception', label: 'Perception', ability: 'wis' },
  { id: 'performance', label: 'Performance', ability: 'cha' },
  { id: 'persuasion', label: 'Persuasion', ability: 'cha' },
  { id: 'religion', label: 'Religion', ability: 'int' },
  { id: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', label: 'Stealth', ability: 'dex' },
  { id: 'survival', label: 'Survival', ability: 'wis' },
]

export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]

export const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function emptyMechanics() {
  return {
    abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    saves: {},
    skills: {},
    hp: { current: null, max: null, temp: 0 },
    ac: null,
    speed: null,
    initiativeBonus: null,
    spellcastingAbility: '',
    spellSlots: {},
    resources: [],
    conditions: [],
    exhaustion: 0,
    concentration: { active: false, spell: '' },
    deathSaves: { success: 0, failure: 0 },
    inventory: [],
    proficiencies: '',
    features: '',
  }
}

export function emptyNarrative() {
  return {
    background: '',
    alignment: '',
    publicPersona: '',
    privateThoughts: '',
    voiceExamples: [],
    dialogueGuidance: '',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    motivations: '',
    philosophy: '',
    history: '',
    relationships: [],
    quirks: [],
    weaknesses: '',
    development: [],
  }
}

// Fills in any keys missing from a stored sheet (older rows, or ones
// saved before a field existed) without touching what's there.
export function normalizeSheet(row) {
  const mechanics = { ...emptyMechanics(), ...(row?.mechanics || {}) }
  mechanics.abilities = { ...emptyMechanics().abilities, ...(mechanics.abilities || {}) }
  mechanics.hp = { ...emptyMechanics().hp, ...(mechanics.hp || {}) }
  mechanics.concentration = { ...emptyMechanics().concentration, ...(mechanics.concentration || {}) }
  mechanics.deathSaves = { ...emptyMechanics().deathSaves, ...(mechanics.deathSaves || {}) }
  const narrative = { ...emptyNarrative(), ...(row?.narrative || {}) }
  return { mechanics, narrative }
}

export const isBlank = (value) => value === null || value === undefined || value === ''

export function abilityModifier(score) {
  if (isBlank(score) || !Number.isFinite(Number(score))) return null
  return Math.floor((Number(score) - 10) / 2)
}

export function proficiencyBonus(level) {
  const n = Number(level)
  if (!Number.isFinite(n) || n < 1) return null
  return 2 + Math.floor((Math.min(n, 20) - 1) / 4)
}

export function formatModifier(value) {
  if (value === null || value === undefined) return '—'
  return value >= 0 ? `+${value}` : `${value}`
}

// Skill proficiency: 0 = none, 1 = proficient, 2 = expertise.
export function skillBonus(mechanics, skill, level) {
  const mod = abilityModifier(mechanics.abilities[skill.ability])
  if (mod === null) return null
  const prof = proficiencyBonus(level) ?? 0
  return mod + prof * (mechanics.skills[skill.id] || 0)
}

export function saveBonus(mechanics, abilityId, level) {
  const mod = abilityModifier(mechanics.abilities[abilityId])
  if (mod === null) return null
  return mod + (mechanics.saves[abilityId] ? proficiencyBonus(level) ?? 0 : 0)
}

// Uses the player's own override if they set one (feats, items…),
// otherwise the Dexterity modifier; null if neither is known.
export function initiativeBonus(mechanics) {
  if (!isBlank(mechanics.initiativeBonus)) return Number(mechanics.initiativeBonus)
  return abilityModifier(mechanics.abilities.dex)
}

export function passivePerception(mechanics, level) {
  const perception = SKILLS.find((s) => s.id === 'perception')
  const bonus = skillBonus(mechanics, perception, level)
  return bonus === null ? null : 10 + bonus
}

// Damage eats temporary HP first, then current HP (never below 0).
// Healing restores current HP up to max (temp HP is unaffected).
export function applyHpChange(hp, amount) {
  const current = Number(hp.current) || 0
  const temp = Number(hp.temp) || 0
  const max = isBlank(hp.max) ? null : Number(hp.max)
  if (amount < 0) {
    const damage = -amount
    const fromTemp = Math.min(temp, damage)
    return { ...hp, temp: temp - fromTemp, current: Math.max(0, current - (damage - fromTemp)) }
  }
  const healed = current + amount
  return { ...hp, current: max === null ? healed : Math.min(max, healed) }
}

export const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
