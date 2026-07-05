import { useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import CampaignView from './components/CampaignView.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import './App.scss'

function App() {
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Adventurer&rsquo;s Log</h1>
        <p className="app__subtitle">Dungeons &amp; Dragons campaign notes</p>
      </header>

      {isSupabaseConfigured ? (
        selectedCampaign ? (
          <CampaignView
            campaignId={selectedCampaign.id}
            campaignName={selectedCampaign.name}
            onBack={() => setSelectedCampaign(null)}
          />
        ) : (
          <Dashboard onOpenCampaign={setSelectedCampaign} />
        )
      ) : (
        <div className="setup-notice panel">
          <h2>Supabase isn&rsquo;t configured yet</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env</code>, add your
            Supabase project&rsquo;s URL and anon key, then restart the dev
            server. See <code>README.md</code> for the full setup steps.
          </p>
        </div>
      )}
    </div>
  )
}

export default App
