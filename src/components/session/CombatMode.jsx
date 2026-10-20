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
// Reopens the roll prompt (players' combat badge, before they've rolled).
const OPEN_ROLL_EVENT = 'dnd-notes-open-initiative-roll'
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

  const [reopened, setReopened] = useState(false)
  useEffect(() => {
    const open = () => setReopened(true)
    window.addEventListener(OPEN_ROLL_EVENT, open)
    return () => window.removeEventListener(OPEN_ROLL_EVENT, open)
  }, [])

  const alert = state.combat ? state.alert : null
  const fresh = useMemo(() => showAlert && isFreshAlert(alert, seen, Date.now()), [showAlert, alert, seen])
  const showing = fresh || (showAlert && reopened && Boolean(alert))
  // Only a new call shakes the screen; reopening from the badge doesn't.
  const shake = fresh

  useEffect(() => {
    if (!shake) return undefined
    navigator.vibrate?.([200, 80, 200, 80, 400])
    document.body.classList.add('combat-shake')
    const timer = setTimeout(() => document.body.classList.remove('combat-shake'), SHAKE_MS)
    return () => {
      clearTimeout(timer)
      document.body.classList.remove('combat-shake')
    }
  }, [shake])

  useEffect(() => {
    if (showing) closeRef.current?.focus()
  }, [showing])

  function dismiss() {
    setReopened(false)
    if (seen.includes(alert.id)) return
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
  const { campaignId, playerId } = useCampaignData()
  const nav = useCampaignNav()
  const { state } = useSharedEncounter(campaignId)
  if (!state.combat) return null
  // A player who hasn't rolled yet gets the roll prompt back.
  const needsRoll =
    !nav.isDm && Boolean(playerId) && !state.started && !state.combatants.some((c) => c.playerId === playerId)
  return (
    <button
      type="button"
      className="combat-badge"
      onClick={() => (needsRoll ? window.dispatchEvent(new Event(OPEN_ROLL_EVENT)) : nav.goTo(target))}
      title={needsRoll ? 'Combat — roll for initiative' : 'Combat'}
      aria-label={`Combat: ${state.started ? `round ${state.round}` : 'rolling for initiative'}.${needsRoll ? ' Roll for initiative' : ''}`}
    >
      <Icon name="quest" />
      <span aria-hidden="true">{state.started ? `Round ${state.round}` : 'Rolling'}</span>
    </button>
  )
}
