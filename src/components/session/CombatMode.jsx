import { useEffect, useMemo, useRef, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { useActiveCharacter } from '../../hooks/useActiveCharacter.js'
import { describeDice, isFreshAlert } from '../../lib/initiative.js'
import RollForMe from './RollForMe.jsx'
import { getStored, setStored } from '../../lib/sessionMode.js'
import Icon from '../Icon.jsx'
import './CombatMode.scss'

const SEEN_LIMIT = 20
const SHAKE_MS = 1200
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
          <RollForMe key={character.id} character={character} dice={alert.dice} />
        ) : (
          <p className="combat-alert__hint">
            Roll {describeDice(alert.dice)} plus your initiative bonus and tell your DM.
          </p>
        )}
        <button type="button" className="btn btn--primary combat-alert__ready" onClick={dismiss} ref={closeRef}>
          Ready
        </button>
      </div>
    </div>
  )
}

// "⚔ Round 2" (or "⚔ Rolling") in the top bar while combat mode is on; opens the
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
      title="Combat — open the initiative tracker"
      aria-label={`Combat: ${state.started ? `round ${state.round}` : 'rolling for initiative'}. Open the initiative tracker`}
    >
      <Icon name="quest" />
      <span aria-hidden="true">{state.started ? `Round ${state.round}` : 'Rolling'}</span>
    </button>
  )
}
