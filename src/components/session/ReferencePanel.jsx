import { useState } from 'react'
import { useSupabaseTable } from '../../hooks/useSupabaseTable.js'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { ABILITIES, SKILLS, formatModifier, saveBonus, skillBonus } from '../../lib/character.js'
import TabNav from '../TabNav.jsx'
import RoleplayQuickRef from '../character/RoleplayQuickRef.jsx'
import { SectionCard, StatusMessage } from '../ui.jsx'

const VIEWS = [
  { id: 'spells', label: 'Spells' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'skills', label: 'Skills' },
  { id: 'roleplay', label: 'Roleplay' },
]

const spellFromRow = (r) => ({
  id: r.id,
  name: r.name,
  level: r.level,
  castingTime: r.casting_time,
  range: r.range,
  components: r.components,
  duration: r.duration,
  effect: r.effect,
  details: r.details,
})

function SpellList({ campaignId, playerId }) {
  const { items, loading, error } = useSupabaseTable('spells', {
    fromRow: spellFromRow,
    orderBy: 'level',
    filters: playerId ? { campaign_id: campaignId, player_id: playerId } : { campaign_id: campaignId },
  })
  return (
    <>
      <StatusMessage loading={loading} error={error} empty={!items.length}>
        No spells saved yet — add them on the Spells screen.
      </StatusMessage>
      {items.length > 0 && (
        <ul className="reference__spells">
          {items.map((s) => (
            <li key={s.id}>
              <details>
                <summary>
                  <span className="reference__spell-name">{s.name}</span>
                  <span className="reference__spell-level">{s.level === 0 ? 'Cantrip' : `Lvl ${s.level}`}</span>
                </summary>
                <dl className="reference__spell-meta">
                  {[
                    ['Casting', s.castingTime],
                    ['Range', s.range],
                    ['Components', s.components],
                    ['Duration', s.duration],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {(s.effect || s.details) && <p>{s.effect || s.details}</p>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// At-the-table lookup: spells, what you're carrying, skill/save bonuses
// and roleplay notes, without leaving Session Mode.
function ReferencePanel({ character, sheet, onEditSheet, onEditRoleplay }) {
  const { campaignId, playerId, tables } = useCampaignData()
  const [view, setView] = useState('spells')
  const m = sheet.mechanics
  const held = tables.loot.items.filter(
    (l) => l.holder && l.holder.trim().toLowerCase() === character.name.trim().toLowerCase(),
  )

  return (
    <SectionCard title="Reference" icon="📚" className="reference">
      <TabNav tabs={VIEWS} activeTab={view} onSelect={setView} className="tab-nav--pill" label="Reference" />

      {view === 'spells' && <SpellList campaignId={campaignId} playerId={playerId} />}

      {view === 'inventory' && (
        <>
          {m.inventory.length === 0 && held.length === 0 ? (
            <p className="inline-state">
              Nothing recorded.{' '}
              <button type="button" className="btn btn--text vitals__setup" onClick={onEditSheet}>
                Add equipment on the sheet
              </button>
            </p>
          ) : (
            <ul className="reference__inventory mechanics">
              {m.inventory.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.equipped && <span title="Equipped">⚔ </span>}
                    {item.name || 'Unnamed item'}
                  </span>
                  <span className="field-hint">×{item.qty ?? 1}</span>
                  {item.notes && <p className="field-hint">{item.notes}</p>}
                </li>
              ))}
              {held.map((l) => (
                <li key={l.id}>
                  <span>💰 {l.item}</span>
                  <span className="field-hint">{l.used ? 'Used' : 'Loot'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'skills' && (
        <div className="reference__skills mechanics">
          <h4>Saving throws</h4>
          <ul>
            {ABILITIES.map((a) => (
              <li key={a.id}>
                <span>
                  {m.saves[a.id] && <span aria-label="proficient">● </span>}
                  {a.label}
                </span>
                <span>{formatModifier(saveBonus(m, a.id, character.level))}</span>
              </li>
            ))}
          </ul>
          <h4>Skills</h4>
          <ul>
            {SKILLS.map((s) => (
              <li key={s.id}>
                <span>
                  {m.skills[s.id] === 2 ? '★ ' : m.skills[s.id] === 1 ? '● ' : ''}
                  {s.label}
                </span>
                <span>{formatModifier(skillBonus(m, s, character.level))}</span>
              </li>
            ))}
          </ul>
          <p className="field-hint">● proficient · ★ expertise · — ability score not entered</p>
        </div>
      )}

      {view === 'roleplay' && <RoleplayQuickRef narrative={sheet.narrative} onEdit={onEditRoleplay} />}
    </SectionCard>
  )
}

export default ReferencePanel
