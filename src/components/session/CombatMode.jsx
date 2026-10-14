import { useEffect, useMemo, useRef, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { useActiveCharacter } from '../../hooks/useActiveCharacter.js'
import { useCharacterSheet } from '../../hooks/useCharacterSheet.js'
import { initiativeBonus } from '../../lib/character.js'
import { isFreshAlert } from '../../lib/initiative.js'
import { getStored, setStored } from '../../lib/sessionMode.js'
import Icon from '../Icon.jsx'
import './CombatMode.scss'

const SEEN_LIMIT = 20
const SHAKE_MS = 1200
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`

// The player's initiative bonus from their sheet (null if not filled in).
function useInitBonus(campaignId, characterId) {
  const { sheet } = useCharacterSheet(campaignId, characterId)
  return sheet ? initiativeBonus(sheet.mechanics) : null
}

function RollHelper({ campaignId, character }) {
  const bonus = useInitBonus(campaignId, character.id)
  const [rolled, setRolled] = useState(null)
  if (bonus == null) {
    return <p className="combat-alert__hint">Roll a d20 plus your initiative bonus and tell your DM.</p>
  }
  return (
    <div className="combat-alert__roll">
      <p className="combat-alert__hint">
        {character.name}: roll <strong>d20 {signed(bonus)}</strong> and tell your DM.
      </p>
      {rolled ? (
        <p className="combat-alert__result" role="status">
          <span className="combat-alert__total">{rolled.die + bonus}</span>
          <span>
            d20 rolled {rolled.die} {signed(bonus)}
            {rolled.die === 20 ? ' — natural 20!' : rolled.die === 1 ? ' — ouch.' : ''}
          </span>
        </p>
      ) : (
        <button type="button" className="btn" onClick={() => setRolled({ die: 1 + Math.floor(Math.random() * 20) })}>
          <Icon name="dice" /> Roll it for me
        </button>
      )}
    </div>
  )
}

// Combat mode for everyone in the campaign, driven by the shared encounter:
// - while the DM has combat on, the whole app takes on a red battle theme
//   (html[data-combat]) and the top bar shows the round;
// - when the DM calls for initiative, players' screens shake (and phones
//   buzz) under a "Roll for initiative!" alert, once per device.
export function CombatMode({ showAlert }) {
  const { campaignId, playerId } = useCampaignData()
  const { state } = useSharedEncounter(campaignId)
  const { character } = useActiveCharacter()
  const seenKey = `dnd-notes-combat-alerts-seen:${campaignId}:${playerId || 'admin'}`
  const [seen, setSeen] = useState(() => getStored(seenKey, []))
  const closeRef = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    if (state.combat) root.dataset.combat = 'true'
    else delete root.dataset.combat
    return () => {
      delete root.dataset.combat
    }
  }, [state.combat])

  const alert = state.combat ? state.alert : null
  const showing = useMemo(() => showAlert && isFreshAlert(alert, seen, Date.now()), [showAlert, alert, seen])

  useEffect(() => {
    if (!showing) return undefined
    navigator.vibrate?.([200, 80, 200, 80, 400])
    document.body.classList.add('combat-shake')
    closeRef.current?.focus()
    const timer = setTimeout(() => document.body.classList.remove('combat-shake'), SHAKE_MS)
    return () => {
      clearTimeout(timer)
      document.body.classList.remove('combat-shake')
    }
  }, [showing])

  function dismiss() {
    const next = [...seen, alert.id].slice(-SEEN_LIMIT)
    setSeen(next)
    setStored(seenKey, next)
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  useEffect(() => {
    if (!showing) return undefined
    const onKey = (event) => event.key === 'Escape' && dismissRef.current()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showing])

  if (!showing) return null
  return (
    <div className="combat-alert" role="alertdialog" aria-modal="true" aria-labelledby="combat-alert-title">
      <div className="combat-alert__card">
        <span className="combat-alert__icon" aria-hidden="true">
          <Icon name="quest" />
        </span>
        <h2 id="combat-alert-title" className="combat-alert__title">
          Roll for initiative!
        </h2>
        <p className="combat-alert__lead">Your DM has started an encounter.</p>
        {character ? (
          <RollHelper key={character.id} campaignId={campaignId} character={character} />
        ) : (
          <p className="combat-alert__hint">Roll a d20 plus your initiative bonus and tell your DM.</p>
        )}
        <button type="button" className="btn btn--primary combat-alert__ready" onClick={dismiss} ref={closeRef}>
          Ready
        </button>
      </div>
    </div>
  )
}

// "Combat · Round 2" in the top bar while combat mode is on; opens the
// tracker (`target` is its tab: Session Mode, or the DM's Combat tab).
export function CombatBadge({ target }) {
  const { campaignId } = useCampaignData()
  const nav = useCampaignNav()
  const { state } = useSharedEncounter(campaignId)
  if (!state.combat) return null
  return (
    <button
      type="button"
      className="combat-badge"
      onClick={() => nav.goTo(target)}
      title="Open the initiative tracker"
    >
      <Icon name="quest" />
      <span>{state.started ? `Combat · Round ${state.round}` : 'Combat · rolling initiative'}</span>
    </button>
  )
}
