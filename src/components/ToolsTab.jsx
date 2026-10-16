import CurrencyCalculator from './CurrencyCalculator.jsx'
import WalletTracker from './WalletTracker.jsx'
import ShardTracker from './ShardTracker.jsx'
import TeamGenerator from './TeamGenerator.jsx'
import { PollsPanel } from './session/Polls.jsx'
import './ToolsTab.scss'

// `showPolls`: the DM runs party votes from here (players vote in Session Mode).
function ToolsTab({ campaignId, playerId, showPolls = false }) {
  return (
    <section className="tools-tab">
      {showPolls && (
        <div className="tools-tab__polls">
          <PollsPanel />
        </div>
      )}
      <CurrencyCalculator />
      <WalletTracker campaignId={campaignId} playerId={playerId} />
      <ShardTracker campaignId={campaignId} playerId={playerId} />
      <TeamGenerator campaignId={campaignId} />
    </section>
  )
}

export default ToolsTab
