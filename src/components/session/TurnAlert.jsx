import { useEffect, useState } from 'react'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { turnInfo } from '../../lib/initiative.js'
import Icon from '../Icon.jsx'
import './TurnAlert.scss'

// A banner on every screen when the shared initiative reaches you: "Your
// turn" (with a buzz on phones that support it) and "You're up next" a
// turn ahead. Tapping it opens Session Mode; × hides it until the turn
// moves on.
function TurnAlert() {
  const { campaignId, playerId } = useCampaignData()
  const nav = useCampaignNav()
  const { state } = useSharedEncounter(campaignId)
  const { current, next } = turnInfo(state)
  const mineNow = Boolean(playerId) && current?.playerId === playerId
  const mineNext = Boolean(playerId) && !mineNow && next?.playerId === playerId
  const key = `${state.round}:${state.turn}:${mineNow ? 'now' : mineNext ? 'next' : ''}`
  const [dismissed, setDismissed] = useState(null)

  useEffect(() => {
    if (mineNow) navigator.vibrate?.([120, 60, 120])
  }, [mineNow, key])

  if ((!mineNow && !mineNext) || dismissed === key) return null

  return (
    <div className={`turn-alert${mineNow ? ' turn-alert--now' : ''}`} role="status" aria-live="assertive">
      <button type="button" className="turn-alert__main" onClick={() => nav.goTo('session')}>
        <Icon name={mineNow ? 'quest' : 'hourglass'} />
        <span>
          <strong>{mineNow ? `Your turn, ${current.name}!` : 'You’re up next'}</strong>
          <span className="turn-alert__sub">
            {mineNow ? `Round ${state.round}` : `${current.name} is acting now · round ${state.round}`}
          </span>
        </span>
      </button>
      <button type="button" className="turn-alert__close" onClick={() => setDismissed(key)} aria-label="Hide">
        <Icon name="close" />
      </button>
    </div>
  )
}

export default TurnAlert
