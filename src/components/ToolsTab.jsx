import CurrencyCalculator from './CurrencyCalculator.jsx'
import WalletTracker from './WalletTracker.jsx'
import './ToolsTab.scss'

function ToolsTab({ campaignId, playerId }) {
  return (
    <section className="tools-tab">
      <CurrencyCalculator />
      <WalletTracker campaignId={campaignId} playerId={playerId} />
    </section>
  )
}

export default ToolsTab
