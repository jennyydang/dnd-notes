import CurrencyCalculator from './CurrencyCalculator.jsx'
import WalletTracker from './WalletTracker.jsx'
import ShardTracker from './ShardTracker.jsx'
import TeamGenerator from './TeamGenerator.jsx'
import { PollsPanel } from './session/Polls.jsx'
import './ToolsTab.scss'

// `isDm`: the DM runs party votes from here (players vote in Session Mode)
// and hands out shards. The Money Tracker is for players' own purses, so a
// DM doesn't get one (the admin, with no playerId, keeps its read-only list).
function ToolsTab({ campaignId, playerId, isDm = false }) {
  return (
    <section className="tools-tab">
      {isDm && (
        <div className="tools-tab__polls">
          <PollsPanel />
        </div>
      )}
      <CurrencyCalculator />
      {(!isDm || !playerId) && <WalletTracker campaignId={campaignId} playerId={playerId} />}
      <ShardTracker campaignId={campaignId} playerId={playerId} manage={isDm} />
      <TeamGenerator campaignId={campaignId} />
    </section>
  )
}

export default ToolsTab
