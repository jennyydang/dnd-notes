import { useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { useCharacterSheet } from '../../hooks/useCharacterSheet.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { initiativeBonus, newId } from '../../lib/character.js'
import { addPlayerRoll, describeDice, rollInitiative } from '../../lib/initiative.js'
import Icon from '../Icon.jsx'

const signed = (n) => `${n >= 0 ? '+' : ''}${n}`

// A player's initiative roll with the dice the DM called for, plus their
// sheet's initiative bonus. "Roll for me" rolls it in the app and puts
// them straight into the shared order; otherwise they roll real dice and
// tell the DM. Mount with key={character.id}.
function RollForMe({ character, dice, compact = false }) {
  const { campaignId, playerId } = useCampaignData()
  const { sheet } = useCharacterSheet(campaignId, character.id)
  const { state, update, error } = useSharedEncounter(campaignId)
  const [rolled, setRolled] = useState(null)
  const bonus = sheet ? initiativeBonus(sheet.mechanics) : null
  const what = `${describeDice(dice)}${bonus != null ? ` ${signed(bonus)}` : ''}`

  const index = state.combatants.findIndex((c) => playerId && c.playerId === playerId)
  const entry = index === -1 ? null : state.combatants[index]

  function roll() {
    const result = rollInitiative(dice, bonus ?? 0)
    setRolled(result)
    update((s) =>
      addPlayerRoll(s, {
        id: newId(),
        name: character.name,
        initiative: result.total,
        hp: null,
        isPlayer: true,
        playerId: playerId || null,
        conditions: [],
      }),
    )
  }

  if (rolled) {
    return (
      <div className={`roll-for-me${compact ? ' roll-for-me--compact' : ''}`} role="status">
        <p className="roll-for-me__result">
          <span className="roll-for-me__total">{rolled.total}</span>
          <span>
            {describeDice(dice)} rolled {rolled.rolls.join(' & ')}
            {rolled.rolls.length > 1 ? ` (kept ${rolled.die})` : ''}
            {bonus ? ` ${signed(bonus)}` : ''}
            {rolled.die === (dice?.sides || 20) ? ' — natural max!' : rolled.die === 1 ? ' — ouch.' : ''}
          </span>
        </p>
        <p className="roll-for-me__added">
          <Icon name="check-square" />{' '}
          {entry ? `In the initiative order — #${index + 1} of ${state.combatants.length}.` : 'Adding you to the order…'}
        </p>
        {error && <p className="field-error">Couldn’t add it: {error}</p>}
      </div>
    )
  }

  if (entry) {
    return (
      <p className="roll-for-me__hint">
        You’re in the order at <strong>#{index + 1}</strong> with initiative <strong>{entry.initiative}</strong>.
      </p>
    )
  }

  return (
    <div className={`roll-for-me${compact ? ' roll-for-me--compact' : ''}`}>
      <p className="roll-for-me__hint">
        {character.name}: roll <strong>{what}</strong>.
        {bonus == null && ' (No initiative bonus on your sheet yet.)'}
      </p>
      <button type="button" className="btn roll-for-me__btn" onClick={roll}>
        <Icon name="dice" /> Roll for me
      </button>
      {!compact && <p className="roll-for-me__or">…or roll real dice and tell your DM.</p>}
    </div>
  )
}

export default RollForMe
