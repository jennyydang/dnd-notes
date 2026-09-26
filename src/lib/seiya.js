import { newId } from './character.js'

// Seiya's roleplay guide. No Seiya character files exist in this project,
// so this is built ONLY from the character brief supplied with the app's
// requirements — nothing beyond it is invented (no relationships, ideals
// or history details). "When" hints on quirks are suggestions for when a
// quirk fits; they're optional reminders, not rules. The player can edit
// or delete anything after applying it.
export const SEIYA_SOURCE =
  'Character brief: aasimar Grave Domain Cleric raised in a traveling hospice caravan.'

export function seiyaGuide() {
  return {
    background: 'Raised in a traveling hospice caravan.',
    publicPersona: 'Warm, reassuring, casual, observant and socially graceful.',
    privateThoughts: 'Analytical, and fascinated by the mechanics of life and death.',
    personality:
      'Warm and reassuring on the outside, analytical on the inside. Remains unusually composed under pressure.',
    history: 'An aasimar Grave Domain Cleric raised in a traveling hospice caravan.',
    dialogueGuidance:
      'Casual and reassuring. Her humour can be dry, dark and unintentionally unsettling — but she is never robotic, emotionless or cruel. She stays calm when others panic.',
    voiceExamples: [
      'Yeah… that probably won’t end well.',
      'You’re doing great. In a concerning way.',
      'Hey, don’t panic. That makes it worse.',
      'If you survived that, you’re probably fine.',
    ],
    quirks: [
      { text: 'Repositions a badly positioned corpse', context: 'after a fight, or finding a body' },
      { text: 'Refuses to step over people, alive or dead', context: 'moving through a crowded or battle-strewn space' },
      { text: 'Listens intensely to last words', context: 'someone is dying' },
      { text: 'Treats minor injuries with hospice-level concern', context: 'an ally gets a small injury' },
      { text: 'Thanks the dead out of habit', context: 'leaving a body, grave or battlefield' },
      { text: 'Remains unusually composed under pressure', context: 'panic, emergencies, danger' },
    ].map((q) => ({ id: newId(), ...q })),
    weaknesses:
      'Dry, dark humour can come across as unintentionally unsettling to people who don’t know her.',
  }
}

export const looksLikeSeiya = (name) => /\bseiya\b/i.test(name || '')

// Merges the guide into a narrative without overwriting anything the
// player already wrote: text fields fill only when blank; lists add only
// entries not already present.
export function applyGuide(narrative, guide) {
  const next = { ...narrative }
  for (const [key, value] of Object.entries(guide)) {
    if (Array.isArray(value)) {
      const existing = next[key] || []
      const keyOf = (item) => (typeof item === 'string' ? item : item.text).trim().toLowerCase()
      const have = new Set(existing.map(keyOf))
      next[key] = [...existing, ...value.filter((item) => !have.has(keyOf(item)))]
    } else if (!String(next[key] || '').trim()) {
      next[key] = value
    }
  }
  return next
}
