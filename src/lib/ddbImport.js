// Converts a D&D Beyond character (the JSON its unofficial character
// service returns for public characters) into this app's character sheet.
//
// D&D Beyond stores choices, not final numbers: an ability score is a base
// value plus bonuses from race, feats and items; AC comes from equipped
// armour and features. Those are re-derived here the same way; anything
// that can't be derived reliably is reported in `warnings` (or left blank)
// rather than guessed. The format is undocumented and may change.

import { SKILLS, newId } from './character.js'

const ABILITY_IDS = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' }
const ABILITY_NAMES = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
}
const ALIGNMENTS = {
  1: 'Lawful Good',
  2: 'Neutral Good',
  3: 'Chaotic Good',
  4: 'Lawful Neutral',
  5: 'True Neutral',
  6: 'Chaotic Neutral',
  7: 'Lawful Evil',
  8: 'Neutral Evil',
  9: 'Chaotic Evil',
}
const ARMOR_LIGHT = 1
const ARMOR_MEDIUM = 2
const ARMOR_HEAVY = 3
const ARMOR_SHIELD = 4

// Standard 5e multiclass spellcaster table (slots for levels 1–9 by
// combined caster level), used when a character has more than one
// spellcasting class.
const MULTICLASS_SLOTS = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const ACTIVATION = { 1: 'Action', 2: 'No action', 3: 'Bonus action', 4: 'Reaction', 6: 'Minute', 7: 'Hour', 8: 'Special' }
const COMPONENTS = { 1: 'V', 2: 'S', 3: 'M' }

// ── Links & raw payloads ────────────────────────────────────────────────

// Accepts a character link in any common shape (dndbeyond.com/characters/…,
// /profile/…/characters/…, ddb.ac/characters/…, the character-service URL)
// or a bare numeric ID. Returns the ID string or null.
export function parseCharacterId(input) {
  const text = String(input || '').trim()
  if (/^\d{3,12}$/.test(text)) return text
  const match = text.match(/characters?\/(\d{3,12})(?:\D|$)/i)
  return match ? match[1] : null
}

// Unwraps the service's { success, data } envelope (or accepts the bare
// character object), validating that it really is a character.
export function unwrapCharacter(payload) {
  const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
  if (!data || typeof data !== 'object' || !Array.isArray(data.stats) || !Array.isArray(data.classes)) {
    throw new Error('That doesn’t look like a D&D Beyond character file.')
  }
  return data
}

export function parseCharacterJson(text) {
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t valid JSON — make sure you saved the page’s raw text.')
  }
  if (payload && payload.success === false) {
    throw new Error(payload.message || 'D&D Beyond returned an error for that character.')
  }
  return unwrapCharacter(payload)
}

// ── Modifiers ───────────────────────────────────────────────────────────

// D&D Beyond lists item modifiers for every item carried; only equipped
// items (and attuned ones, where attunement is required) actually apply.
function activeModifiers(ddb) {
  const groups = ddb.modifiers || {}
  const activeItemIds = new Set(
    (ddb.inventory || [])
      .filter((item) => item.equipped && (!item.definition?.canAttune || item.isAttuned))
      .map((item) => item.definition?.id),
  )
  const all = []
  for (const [source, list] of Object.entries(groups)) {
    for (const mod of list || []) {
      if (source === 'item' && !activeItemIds.has(mod.componentId)) continue
      all.push(mod)
    }
  }
  return all
}

const ofType = (mods, type, subType) => mods.filter((m) => m.type === type && (!subType || m.subType === subType))
const sumOf = (mods, type, subType) => ofType(mods, type, subType).reduce((s, m) => s + (Number(m.value) || 0), 0)

const modifier = (score) => Math.floor((score - 10) / 2)

// ── Derived values ──────────────────────────────────────────────────────

export function abilityScores(ddb, mods = activeModifiers(ddb)) {
  const scores = {}
  for (const [id, key] of Object.entries(ABILITY_IDS)) {
    const numId = Number(id)
    const override = (ddb.overrideStats || []).find((s) => s.id === numId && s.value != null)
    if (override) {
      scores[key] = override.value
      continue
    }
    const base = (ddb.stats || []).find((s) => s.id === numId)?.value ?? null
    if (base === null) {
      scores[key] = null
      continue
    }
    const manualBonus = (ddb.bonusStats || []).find((s) => s.id === numId)?.value || 0
    let score = base + manualBonus + sumOf(mods, 'bonus', `${ABILITY_NAMES[key]}-score`)
    // "Set" effects (e.g. Belt of Giant Strength) raise the score to a value.
    const setTo = ofType(mods, 'set', `${ABILITY_NAMES[key]}-score`).map((m) => Number(m.value) || 0)
    if (setTo.length) score = Math.max(score, ...setTo)
    scores[key] = score
  }
  return scores
}

export function totalLevel(ddb) {
  return Math.max(1, Math.min(20, (ddb.classes || []).reduce((s, c) => s + (c.level || 0), 0)))
}

export function maxHitPoints(ddb, scores, mods) {
  if (ddb.overrideHitPoints) return ddb.overrideHitPoints
  if (ddb.baseHitPoints == null || scores.con == null) return null
  const level = totalLevel(ddb)
  return (
    ddb.baseHitPoints +
    modifier(scores.con) * level +
    sumOf(mods, 'bonus', 'hit-points-per-level') * level +
    (ddb.bonusHitPoints || 0)
  )
}

// AC from equipped armour and shield, unarmoured-defence features, and
// flat bonuses. Returns null when DEX is unknown.
export function armorClass(ddb, scores, mods) {
  if (scores.dex == null) return null
  const dex = modifier(scores.dex)
  const equipped = (ddb.inventory || []).filter((i) => i.equipped && i.definition)
  const armour = equipped.filter((i) => i.definition.filterType === 'Armor' && i.definition.armorTypeId !== ARMOR_SHIELD)
  const shields = equipped.filter((i) => i.definition.armorTypeId === ARMOR_SHIELD)

  let base = 10 + dex
  if (armour.length) {
    base = Math.max(
      ...armour.map((i) => {
        const ac = i.definition.armorClass || 0
        if (i.definition.armorTypeId === ARMOR_LIGHT) return ac + dex
        if (i.definition.armorTypeId === ARMOR_MEDIUM) return ac + Math.min(dex, 2)
        if (i.definition.armorTypeId === ARMOR_HEAVY) return ac
        return ac + dex
      }),
    )
  } else {
    for (const m of ofType(mods, 'set', 'unarmored-armor-class')) {
      const statKey = ABILITY_IDS[m.statId]
      const extra = statKey && scores[statKey] != null ? modifier(scores[statKey]) : 0
      base = Math.max(base, 10 + dex + extra + (Number(m.value) || 0))
    }
  }
  const shield = shields.length ? Math.max(...shields.map((i) => i.definition.armorClass || 0)) : 0
  return base + shield + sumOf(mods, 'bonus', 'armor-class')
}

function spellSlots(ddb) {
  const casters = (ddb.classes || []).filter(
    (c) => c.definition?.canCastSpells || c.subclassDefinition?.canCastSpells,
  )
  const slots = {}
  if (casters.length === 1) {
    const c = casters[0]
    const rules = c.definition?.spellRules || c.subclassDefinition?.spellRules
    const row = rules?.levelSpellSlots?.[c.level]
    if (Array.isArray(row)) row.forEach((n, i) => n > 0 && (slots[i + 1] = n))
  } else if (casters.length > 1) {
    let casterLevel = 0
    for (const c of casters) {
      const rules = c.definition?.spellRules || c.subclassDefinition?.spellRules || {}
      const divisor = rules.multiClassSpellSlotDivisor || 1
      const roundUp = rules.multiClassSpellSlotRounding === 2
      casterLevel += roundUp ? Math.ceil(c.level / divisor) : Math.floor(c.level / divisor)
    }
    ;(MULTICLASS_SLOTS[Math.min(20, casterLevel)] || []).forEach((n, i) => (slots[i + 1] = n))
  }
  // Fall back to what the service reports, if it reports anything.
  if (!Object.keys(slots).length) {
    for (const s of ddb.spellSlots || []) if (s.available > 0) slots[s.level] = s.available
  }
  const used = Object.fromEntries((ddb.spellSlots || []).map((s) => [s.level, s.used || 0]))
  return Object.fromEntries(
    Object.entries(slots).map(([lvl, max]) => [lvl, { max, used: Math.min(max, used[lvl] || 0) }]),
  )
}

const stripHtml = (html) =>
  String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;|&#39;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

function describeRange(range) {
  if (!range) return ''
  if (range.rangeValue) return `${range.rangeValue} ft${range.aoeValue ? ` (${range.aoeValue}-ft ${range.aoeType || 'area'})` : ''}`
  return range.origin || ''
}

function describeDuration(d) {
  if (!d) return ''
  if (d.durationType === 'Instantaneous' || d.durationType === 'Special') return d.durationType
  const amount = d.durationInterval ? `${d.durationInterval} ${d.durationUnit || ''}`.trim() : d.durationUnit || ''
  return d.durationType === 'Concentration' ? `Concentration, up to ${amount}` : amount || d.durationType || ''
}

function mapSpell(spell) {
  const d = spell.definition || {}
  const act = d.activation
  return {
    name: d.name || 'Unnamed spell',
    level: Math.max(0, Math.min(9, d.level || 0)),
    casting_time: act ? `${act.activationTime > 1 ? `${act.activationTime} ` : '1 '}${ACTIVATION[act.activationType] || ''}`.trim() : '',
    range: describeRange(d.range),
    components: [
      (d.components || []).map((c) => COMPONENTS[c]).filter(Boolean).join(', '),
      d.componentsDescription ? `(${d.componentsDescription})` : '',
    ]
      .filter(Boolean)
      .join(' '),
    duration: describeDuration(d.duration),
    effect: stripHtml(d.description).slice(0, 2000),
    details: [d.school, d.concentration && 'Concentration', d.ritual && 'Ritual'].filter(Boolean).join(' · '),
  }
}

function collectSpells(ddb) {
  const seen = new Set()
  const out = []
  const lists = [
    ...Object.values(ddb.spells || {}),
    ...(ddb.classSpells || []).map((c) => c.spells),
  ]
  for (const list of lists) {
    for (const spell of list || []) {
      const mapped = mapSpell(spell)
      const key = mapped.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(mapped)
    }
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

const SKILL_SLUGS = Object.fromEntries(
  SKILLS.map((s) => [s.label.toLowerCase().replace(/\s+/g, '-'), s.id]),
)

// ── Main mapping ────────────────────────────────────────────────────────

// Returns { identity, mechanics, narrative, spells, warnings } — partial
// sheet data ready to preview and merge (see applyImport).
export function mapDdbCharacter(ddb) {
  const mods = activeModifiers(ddb)
  const scores = abilityScores(ddb, mods)
  const level = totalLevel(ddb)
  const warnings = []

  const classes = (ddb.classes || [])
    .slice()
    .sort((a, b) => (b.isStartingClass ? 1 : 0) - (a.isStartingClass ? 1 : 0))
  const classText = classes
    .map((c) => {
      const name = c.definition?.name || 'Class'
      const sub = c.subclassDefinition?.name
      return `${name}${sub ? ` (${sub})` : ''}${classes.length > 1 ? ` ${c.level}` : ''}`
    })
    .join(' / ')
  const race = ddb.race?.fullName || ddb.race?.baseRaceName || ''

  const saves = {}
  for (const [key, name] of Object.entries(ABILITY_NAMES)) {
    if (ofType(mods, 'proficiency', `${name}-saving-throws`).length) saves[key] = true
  }

  const skills = {}
  for (const [slug, id] of Object.entries(SKILL_SLUGS)) {
    if (ofType(mods, 'expertise', slug).length) skills[id] = 2
    else if (ofType(mods, 'proficiency', slug).length) skills[id] = 1
  }

  const skillOrSave = new Set([
    ...Object.keys(SKILL_SLUGS),
    ...Object.values(ABILITY_NAMES).map((n) => `${n}-saving-throws`),
  ])
  const proficiencies = [
    ...new Set(ofType(mods, 'proficiency').filter((m) => !skillOrSave.has(m.subType)).map((m) => m.friendlySubtypeName || m.subType)),
  ]
  const languages = [...new Set(ofType(mods, 'language').map((m) => m.friendlySubtypeName || m.subType))]

  const features = [
    ...(ddb.race?.racialTraits || []).map((t) => t.definition?.name),
    ...classes.flatMap((c) =>
      [...(c.classFeatures || []), ...(c.subclassDefinition?.classFeatures || [])]
        .map((f) => f.definition || f)
        .filter((f) => f && (f.requiredLevel ?? 0) <= c.level)
        .map((f) => f.name),
    ),
    ...(ddb.feats || []).map((f) => (f.definition?.name ? `Feat: ${f.definition.name}` : null)),
  ].filter((name, i, all) => name && !/^(Ability Score Improvement|Hit Points|Proficiencies)$/i.test(name) && all.indexOf(name) === i)

  const inventory = [
    ...(ddb.inventory || []).map((item) => ({
      id: newId(),
      name: item.definition?.name || 'Item',
      qty: item.quantity ?? 1,
      equipped: Boolean(item.equipped),
      notes: [item.definition?.rarity && item.definition.rarity !== 'Common' ? item.definition.rarity : '', item.isAttuned ? 'Attuned' : '']
        .filter(Boolean)
        .join(' · '),
    })),
    ...(ddb.customItems || []).map((item) => ({
      id: newId(),
      name: item.name || 'Custom item',
      qty: item.quantity ?? 1,
      equipped: false,
      notes: stripHtml(item.description).slice(0, 200),
    })),
  ]

  const resources = []
  for (const list of Object.values(ddb.actions || {})) {
    for (const action of list || []) {
      const use = action.limitedUse
      if (!use || !use.maxUses) continue
      resources.push({
        id: newId(),
        name: action.name,
        max: use.maxUses,
        current: Math.max(0, use.maxUses - (use.numberUsed || 0)),
        reset: use.resetType === 1 ? 'short' : use.resetType === 2 ? 'long' : '',
      })
    }
  }

  const maxHp = maxHitPoints(ddb, scores, mods)
  const ac = armorClass(ddb, scores, mods)
  if (ac !== null) warnings.push('AC is calculated from equipped armour and features — double-check it against D&D Beyond.')
  if (maxHp === null) warnings.push('Max HP couldn’t be worked out — enter it on the sheet.')
  if (ddb.pactMagic && (Array.isArray(ddb.pactMagic) ? ddb.pactMagic.length : true)) {
    warnings.push('Warlock pact slots aren’t imported — add them as a resource.')
  }

  const initiative = scores.dex == null ? null : modifier(scores.dex) + sumOf(mods, 'bonus', 'initiative')
  const castingClass = classes.find((c) => c.definition?.canCastSpells && c.definition?.spellCastingAbilityId)
  const speed = (ddb.race?.weightSpeeds?.normal?.walk ?? null)

  const traits = ddb.traits || {}
  const notes = ddb.notes || {}

  return {
    identity: { name: ddb.name || '', raceClass: [race, classText].filter(Boolean).join(' '), level },
    mechanics: {
      abilities: scores,
      saves,
      skills,
      hp: {
        max: maxHp,
        current: maxHp === null ? null : Math.max(0, maxHp - (ddb.removedHitPoints || 0)),
        temp: ddb.temporaryHitPoints || 0,
      },
      ac,
      speed: speed === null ? null : speed + sumOf(mods, 'bonus', 'speed'),
      initiativeBonus: initiative !== null && initiative !== modifier(scores.dex) ? initiative : null,
      spellcastingAbility: castingClass ? ABILITY_IDS[castingClass.definition.spellCastingAbilityId] || '' : '',
      spellSlots: spellSlots(ddb),
      resources,
      inventory,
      proficiencies: [proficiencies.length && `Proficiencies: ${proficiencies.join(', ')}`, languages.length && `Languages: ${languages.join(', ')}`]
        .filter(Boolean)
        .join('\n'),
      features: features.join('\n'),
    },
    narrative: {
      background: ddb.background?.definition?.name || '',
      alignment: ALIGNMENTS[ddb.alignmentId] || '',
      personality: stripHtml(traits.personalityTraits),
      ideals: stripHtml(traits.ideals),
      bonds: stripHtml(traits.bonds),
      flaws: stripHtml(traits.flaws),
      history: stripHtml(notes.backstory),
    },
    spells: collectSpells(ddb),
    warnings,
  }
}

// ── Merging ─────────────────────────────────────────────────────────────

export const IMPORT_SECTIONS = [
  { id: 'abilities', label: 'Ability scores, saves & skills' },
  { id: 'combat', label: 'HP, AC, speed & initiative' },
  { id: 'spellcasting', label: 'Spellcasting ability & spell slots' },
  { id: 'features', label: 'Features, proficiencies & languages' },
  { id: 'resources', label: 'Limited-use resources' },
  { id: 'inventory', label: 'Inventory (replaces the current list)' },
  { id: 'roleplay', label: 'Background, alignment & personality (empty fields only)' },
]

// Applies the chosen sections of an import to a { mechanics, narrative }
// sheet. Mechanics are replaced by D&D Beyond's values (that's the point
// of importing), except that a value D&D Beyond doesn't know never wipes
// one already entered. Roleplay text only fills fields that are empty, so
// nothing the player wrote in this app is overwritten.
export function applyImport(sheet, imported, sections) {
  const on = new Set(sections)
  const m = { ...sheet.mechanics }
  const src = imported.mechanics
  const keep = (next, current) => (next === null || next === undefined ? current : next)

  if (on.has('abilities')) {
    m.abilities = Object.fromEntries(Object.entries(m.abilities).map(([k, v]) => [k, keep(src.abilities[k], v)]))
    m.saves = { ...src.saves }
    m.skills = { ...src.skills }
  }
  if (on.has('combat')) {
    m.hp = {
      max: keep(src.hp.max, m.hp.max),
      current: keep(src.hp.current, m.hp.current),
      temp: src.hp.temp || 0,
    }
    m.ac = keep(src.ac, m.ac)
    m.speed = keep(src.speed, m.speed)
    m.initiativeBonus = src.initiativeBonus
  }
  if (on.has('spellcasting')) {
    m.spellcastingAbility = src.spellcastingAbility || m.spellcastingAbility
    m.spellSlots = { ...src.spellSlots }
  }
  if (on.has('features')) {
    m.features = src.features || m.features
    m.proficiencies = src.proficiencies || m.proficiencies
  }
  if (on.has('resources')) m.resources = src.resources
  if (on.has('inventory')) m.inventory = src.inventory

  const n = { ...sheet.narrative }
  if (on.has('roleplay')) {
    for (const [key, value] of Object.entries(imported.narrative)) {
      if (value && !String(n[key] || '').trim()) n[key] = value
    }
  }
  return { mechanics: m, narrative: n }
}

// ── Fetching ────────────────────────────────────────────────────────────

export const characterServiceUrl = (id) =>
  `https://character-service.dndbeyond.com/character/v5/character/${id}`

// Asks this app's /api/ddb-character helper (a Vercel Function) for the
// character. Throws a player-friendly message on any failure.
export async function fetchDdbCharacter(id, { signal } = {}) {
  let response
  try {
    response = await fetch(`/api/ddb-character?id=${encodeURIComponent(id)}`, { signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('Couldn’t reach the import service. Check your connection, or upload the file instead.')
  }
  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  if (!isJson) {
    throw new Error('The import service isn’t available here — use “Upload a file instead” below.')
  }
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Import failed.')
  return unwrapCharacter(body)
}
