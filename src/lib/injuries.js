// Combat injuries (character sheet mechanics.injuries): where a character
// got hit and how much it hurts, 1–5. Rests ease them; magic or a healer
// clears them (the "Fully healed" button).

export const REGIONS = [
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest' },
  { id: 'stomach', label: 'Stomach' },
  { id: 'right-arm', label: 'Right arm' },
  { id: 'left-arm', label: 'Left arm' },
  { id: 'right-leg', label: 'Right leg' },
  { id: 'left-leg', label: 'Left leg' },
  { id: 'back', label: 'Back' },
]

export const PAIN_LEVELS = [
  { value: 1, label: 'Sore' },
  { value: 2, label: 'Aching' },
  { value: 3, label: 'Painful' },
  { value: 4, label: 'Severe' },
  { value: 5, label: 'Agonizing' },
]

export const painLabel = (value) => PAIN_LEVELS.find((p) => p.value === value)?.label || ''
export const regionLabel = (id) => REGIONS.find((r) => r.id === id)?.label || id

// How many pain levels a rest takes off each injury. HP comes back in
// full on a long rest, but a wound takes a few nights to stop hurting.
export const REST_HEALING = { short: 1, long: 2 }

// Injuries after a rest: each eases by the rest's amount, and any that
// reach 0 are healed (removed).
export function healInjuries(injuries, kind) {
  const amount = REST_HEALING[kind] || 0
  return (injuries || []).map((i) => ({ ...i, pain: i.pain - amount })).filter((i) => i.pain > 0)
}

export const worstPain = (injuries) => (injuries || []).reduce((max, i) => Math.max(max, i.pain), 0)
export const byPain = (injuries) => [...(injuries || [])].sort((a, b) => b.pain - a.pain)

// The party's health from their character sheets: one entry per player
// character (NPC companions left out), most hurt first.
export function partyHealth(party, sheets) {
  const sheetFor = new Map((sheets || []).map((s) => [s.party_member_id, s]))
  return (party || [])
    .filter((m) => m.member_type !== 'NPC')
    .map((member) => {
      const mech = sheetFor.get(member.id)?.mechanics || {}
      const injuries = byPain(Array.isArray(mech.injuries) ? mech.injuries : [])
      const hp = mech.hp && mech.hp.max !== '' && mech.hp.max != null ? mech.hp : null
      return { member, injuries, worst: worstPain(injuries), hp, conditions: mech.conditions || [] }
    })
    .sort((a, b) => b.worst - a.worst || (a.member.name || '').localeCompare(b.member.name || ''))
}
