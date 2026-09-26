import CurrencyCalculator from './CurrencyCalculator.jsx'
import WalletTracker from './WalletTracker.jsx'
import ShardTracker from './ShardTracker.jsx'
import TeamGenerator from './TeamGenerator.jsx'
import './ToolsTab.scss'

function ToolsTab({ campaignId, playerId }) {
  return (
    <section className="tools-tab">
      <CurrencyCalculator />
      <WalletTracker campaignId={campaignId} playerId={playerId} />
      <ShardTracker campaignId={campaignId} playerId={playerId} />
      <TeamGenerator campaignId={campaignId} />
    </section>
  )
}

export default ToolsTab
