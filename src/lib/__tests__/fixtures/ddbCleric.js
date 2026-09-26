// Shaped like D&D Beyond's character-service v5 response (trimmed).
const mod = (type, subType, value = null, extra = {}) => ({
  type,
  subType,
  value,
  friendlySubtypeName: subType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  componentId: 0,
  ...extra,
})
export const cleric = {
  id: 123456789,
  name: 'Seiya',
  alignmentId: 2,
  race: { fullName: 'Aasimar', baseRaceName: 'Aasimar', weightSpeeds: { normal: { walk: 30 } }, racialTraits: [{ definition: { name: 'Celestial Resistance' } }] },
  background: { definition: { name: 'Acolyte' } },
  stats: [1, 2, 3, 4, 5, 6].map((id, i) => ({ id, value: [10, 12, 14, 10, 15, 13][i] })),
  bonusStats: [1, 2, 3, 4, 5, 6].map((id) => ({ id, value: null })),
  overrideStats: [1, 2, 3, 4, 5, 6].map((id) => ({ id, value: null })),
  baseHitPoints: 18,
  bonusHitPoints: null,
  overrideHitPoints: null,
  removedHitPoints: 5,
  temporaryHitPoints: 0,
  classes: [
    {
      level: 3,
      isStartingClass: true,
      definition: {
        name: 'Cleric',
        canCastSpells: true,
        spellCastingAbilityId: 5,
        spellRules: { levelSpellSlots: [[0], [2], [3], [4, 2], [4, 3]], multiClassSpellSlotDivisor: 1, multiClassSpellSlotRounding: 1 },
      },
      subclassDefinition: { name: 'Grave Domain', classFeatures: [{ definition: { name: 'Circle of Mortality', requiredLevel: 1 } }] },
      classFeatures: [
        { definition: { name: 'Spellcasting', requiredLevel: 1 } },
        { definition: { name: 'Channel Divinity', requiredLevel: 2 } },
        { definition: { name: 'Destroy Undead', requiredLevel: 5 } },
      ],
    },
  ],
  modifiers: {
    race: [mod('bonus', 'charisma-score', 2), mod('bonus', 'wisdom-score', 1), mod('language', 'celestial')],
    class: [
      mod('proficiency', 'wisdom-saving-throws'),
      mod('proficiency', 'charisma-saving-throws'),
      mod('proficiency', 'medicine'),
      mod('proficiency', 'insight'),
      mod('proficiency', 'medium-armor'),
    ],
    background: [mod('proficiency', 'religion'), mod('expertise', 'religion'), mod('language', 'common')],
    item: [mod('bonus', 'armor-class', 1, { componentId: 900 })],
    feat: [],
    condition: [],
  },
  inventory: [
    { equipped: true, quantity: 1, definition: { id: 100, name: 'Scale Mail', filterType: 'Armor', armorTypeId: 2, armorClass: 14 } },
    { equipped: true, quantity: 1, definition: { id: 101, name: 'Shield', filterType: 'Armor', armorTypeId: 4, armorClass: 2 } },
    { equipped: true, isAttuned: false, quantity: 1, definition: { id: 900, name: 'Ring of Protection', canAttune: true, rarity: 'Rare' } },
    { equipped: false, quantity: 10, definition: { id: 102, name: 'Candle' } },
  ],
  customItems: [{ name: 'Grandmother’s bell', quantity: 1, description: '<p>Rings for the dead</p>' }],
  spellSlots: [{ level: 1, used: 1, available: 0 }, { level: 2, used: 0, available: 0 }],
  spells: {
    class: [{ definition: { name: 'Bane', level: 1, school: 'Enchantment', concentration: true, activation: { activationTime: 1, activationType: 1 }, range: { origin: 'Ranged', rangeValue: 30 }, components: [1, 2, 3], componentsDescription: 'a drop of blood', duration: { durationType: 'Concentration', durationInterval: 1, durationUnit: 'Minute' }, description: '<p>Up to three creatures…</p>' } }],
    race: [{ definition: { name: 'Light', level: 0, school: 'Evocation', activation: { activationTime: 1, activationType: 1 }, range: { origin: 'Touch' }, components: [1, 3], duration: { durationType: 'Time', durationInterval: 1, durationUnit: 'Hour' }, description: 'Glow' } }],
  },
  classSpells: [
    {
      spells: [
        { definition: { name: 'Toll the Dead', level: 0, school: 'Necromancy', activation: { activationTime: 1, activationType: 1 }, range: { origin: 'Ranged', rangeValue: 60 }, components: [1, 2], duration: { durationType: 'Instantaneous' }, description: 'Dong' } },
        { definition: { name: 'Bane', level: 1, school: 'Enchantment', description: 'dup' } },
      ],
    },
  ],
  actions: { class: [{ name: 'Channel Divinity', limitedUse: { maxUses: 1, numberUsed: 1, resetType: 1 } }], race: [{ name: 'Healing Hands', limitedUse: { maxUses: 1, numberUsed: 0, resetType: 2 } }] },
  feats: [],
  traits: { personalityTraits: 'Calm around the dying.', ideals: '<p>Mercy</p>', bonds: 'The caravan', flaws: 'Too blunt', appearance: 'Pale' },
  notes: { backstory: 'Raised in a hospice caravan.' },
}
