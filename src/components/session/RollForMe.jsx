import { useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { useCharacterSheet } from '../../hooks/useCharacterSheet.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { initiativeBonus, newId } from '../../lib/character.js'
import { addPlayerRoll, describeDice, rollInitiative } from '../../lib/initiative.js'
import Icon from '../Icon.jsx'

const signed = (n) => `${n >= 0 ? '+' : ''}${n}`

// The roll result, big enough to read across the table.
function BigNumber({ label, value, compact }) {
  return (
    <p className={`roll-for-me__big${compact ? ' roll-for-me__big--compact' : ''}`}>
      <span className="roll-for-me__big-label">{label}</span>
      <span className="roll-for-me__big-value">{value}</span>
    </p>
  )
}

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

  const natural = rolled && rolled.die === (dice?.sides || 20) ? 'Natural max!' : rolled?.die === 1 ? 'Ouch — a 1.' : null

  if (rolled) {
    return (
      <div className={`roll-for-me${compact ? ' roll-for-me--compact' : ''}`} role="status">
        <BigNumber label="Your initiative" value={rolled.total} compact={compact} />
        <p className="roll-for-me__breakdown">
          {describeDice(dice)}: rolled {rolled.rolls.join(' & ')}
          {rolled.rolls.length > 1 ? `, kept ${rolled.die}` : ''}
          {bonus ? `, ${signed(bonus)}` : ''} = {rolled.total}
          {natural && <strong className="roll-for-me__natural"> {natural}</strong>}
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
      <div className={`roll-for-me${compact ? ' roll-for-me--compact' : ''}`}>
        <BigNumber label="Your initiative" value={entry.initiative} compact={compact} />
        <p className="roll-for-me__added">
          <Icon name="check-square" /> #{index + 1} of {state.combatants.length} in the order.
        </p>
      </div>
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
