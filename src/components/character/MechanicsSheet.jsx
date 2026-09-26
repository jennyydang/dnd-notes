import {
  ABILITIES,
  SKILLS,
  SPELL_LEVELS,
  abilityModifier,
  formatModifier,
  initiativeBonus,
  passivePerception,
  proficiencyBonus,
  saveBonus,
  skillBonus,
} from '../../lib/character.js'
import { SectionCard } from '../ui.jsx'
import { ListEditor, NumberField, TextArea } from './fields.jsx'

const SKILL_LEVELS = [
  { value: 0, label: '—' },
  { value: 1, label: 'Proficient' },
  { value: 2, label: 'Expertise' },
]

const RESET_OPTIONS = [
  { value: '', label: 'Manual' },
  { value: 'short', label: 'Short rest' },
  { value: 'long', label: 'Long rest' },
]

// The mechanical half of the character sheet. Level and race/class come
// from the Party roster (one source of truth); everything else is entered
// here and autosaved. Derived numbers are computed, never guessed.
function MechanicsSheet({ character, sheetApi }) {
  const { sheet, updateMechanics } = sheetApi
  const m = sheet.mechanics
  const level = character.level
  const prof = proficiencyBonus(level)
  const noAbilities = ABILITIES.every((a) => m.abilities[a.id] === null)

  return (
    <div className="sheet mechanics">
      <SectionCard title="Combat" icon="🛡️">
        <div className="sheet__grid">
          <NumberField label="Max HP" value={m.hp.max} max={999} onChange={(v) => updateMechanics({ hp: { ...m.hp, max: v, current: m.hp.current ?? v } })} />
          <NumberField label="Current HP" value={m.hp.current} max={999} onChange={(v) => updateMechanics({ hp: { ...m.hp, current: v } })} />
          <NumberField label="Armor Class" value={m.ac} max={40} onChange={(v) => updateMechanics({ ac: v })} />
          <NumberField label="Speed (ft)" value={m.speed} max={200} onChange={(v) => updateMechanics({ speed: v })} />
          <NumberField
            label="Initiative bonus"
            value={m.initiativeBonus}
            min={-10}
            max={20}
            onChange={(v) => updateMechanics({ initiativeBonus: v })}
            hint={
              m.initiativeBonus === null
                ? `Blank = DEX modifier (${formatModifier(abilityModifier(m.abilities.dex))})`
                : 'Overrides the DEX modifier'
            }
          />
        </div>
        <dl className="sheet__derived">
          <div>
            <dt>Proficiency</dt>
            <dd>{formatModifier(prof)}</dd>
          </div>
          <div>
            <dt>Initiative</dt>
            <dd>{formatModifier(initiativeBonus(m))}</dd>
          </div>
          <div>
            <dt>Passive Perception</dt>
            <dd>{passivePerception(m, level) ?? '—'}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Ability scores" icon="🎲">
        {noAbilities && <p className="field-hint">Enter your scores from your character sheet — modifiers, saves and skills update automatically.</p>}
        <div className="sheet__abilities">
          {ABILITIES.map((a) => (
            <div key={a.id} className="sheet__ability">
              <NumberField
                label={a.label}
                value={m.abilities[a.id]}
                min={1}
                max={30}
                onChange={(v) => updateMechanics({ abilities: { ...m.abilities, [a.id]: v } })}
              />
              <span className="sheet__mod" aria-label={`${a.label} modifier`}>
                {formatModifier(abilityModifier(m.abilities[a.id]))}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Saving throws" icon="🧷">
        <ul className="sheet__checks">
          {ABILITIES.map((a) => (
            <li key={a.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(m.saves[a.id])}
                  onChange={(e) => updateMechanics({ saves: { ...m.saves, [a.id]: e.target.checked } })}
                />
                {a.label}
                <span className="sr-only"> saving throw proficiency</span>
              </label>
              <span className="sheet__bonus">{formatModifier(saveBonus(m, a.id, level))}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Skills" icon="🧠">
        <ul className="sheet__skills">
          {SKILLS.map((s) => (
            <li key={s.id}>
              <label htmlFor={`skill-${s.id}`}>
                {s.label} <span className="field-hint">({s.ability.toUpperCase()})</span>
              </label>
              <select
                id={`skill-${s.id}`}
                value={m.skills[s.id] || 0}
                onChange={(e) => updateMechanics({ skills: { ...m.skills, [s.id]: Number(e.target.value) } })}
              >
                {SKILL_LEVELS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="sheet__bonus">{formatModifier(skillBonus(m, s, level))}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Spellcasting" icon="✨">
        <div className="field sheet__casting">
          <label htmlFor="spell-ability">Spellcasting ability</label>
          <select
            id="spell-ability"
            value={m.spellcastingAbility}
            onChange={(e) => updateMechanics({ spellcastingAbility: e.target.value })}
          >
            <option value="">None</option>
            {ABILITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {m.spellcastingAbility && (
          <dl className="sheet__derived">
            <div>
              <dt>Spell save DC</dt>
              <dd>
                {abilityModifier(m.abilities[m.spellcastingAbility]) === null
                  ? '—'
                  : 8 + prof + abilityModifier(m.abilities[m.spellcastingAbility])}
              </dd>
            </div>
            <div>
              <dt>Spell attack</dt>
              <dd>
                {abilityModifier(m.abilities[m.spellcastingAbility]) === null
                  ? '—'
                  : formatModifier(prof + abilityModifier(m.abilities[m.spellcastingAbility]))}
              </dd>
            </div>
          </dl>
        )}
        <p className="field-hint">Spell slots per level (leave 0 for none). Spend and restore them in Session Mode.</p>
        <div className="sheet__slots">
          {SPELL_LEVELS.map((lvl) => {
            const slot = m.spellSlots[lvl] || { max: 0, used: 0 }
            return (
              <NumberField
                key={lvl}
                label={`Level ${lvl}`}
                value={slot.max || null}
                max={9}
                onChange={(v) =>
                  updateMechanics({
                    spellSlots: { ...m.spellSlots, [lvl]: { max: v || 0, used: Math.min(slot.used, v || 0) } },
                  })
                }
              />
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="Resources & features" icon="🔋">
        <ListEditor
          label="Limited-use resources"
          items={m.resources}
          onChange={(resources) => updateMechanics({ resources })}
          fields={[
            { key: 'name', label: 'Name', placeholder: 'Channel Divinity' },
            { key: 'current', label: 'Current', type: 'number' },
            { key: 'max', label: 'Max', type: 'number' },
            { key: 'reset', label: 'Recharges', type: 'select', options: RESET_OPTIONS },
          ]}
          newItem={{ name: '', current: null, max: null, reset: '' }}
          addLabel="Add resource"
          emptyText="Track things like Channel Divinity, Bardic Inspiration or item charges."
        />
        <TextArea label="Features & traits" value={m.features} onChange={(features) => updateMechanics({ features })} rows={4} />
        <TextArea
          label="Proficiencies & languages"
          value={m.proficiencies}
          onChange={(proficiencies) => updateMechanics({ proficiencies })}
          rows={3}
          placeholder="Armor, weapons, tools, languages…"
        />
      </SectionCard>

      <SectionCard title="Inventory & equipment" icon="🎒">
        <ListEditor
          label="Items"
          items={m.inventory}
          onChange={(inventory) => updateMechanics({ inventory })}
          fields={[
            { key: 'name', label: 'Item', placeholder: 'Mace' },
            { key: 'qty', label: 'Qty', type: 'number' },
            { key: 'equipped', label: 'Equipped', type: 'checkbox' },
            { key: 'notes', label: 'Notes', placeholder: '1d6 bludgeoning' },
          ]}
          newItem={{ name: '', qty: 1, equipped: false, notes: '' }}
          addLabel="Add item"
          emptyText="Party loot held by this character also shows in Session Mode."
        />
      </SectionCard>
    </div>
  )
}

export default MechanicsSheet
