import { useState } from 'react'
import AdminGate from './components/AdminGate.jsx'
import PlayerLogin from './components/PlayerLogin.jsx'
import PlayerDashboard from './components/PlayerDashboard.jsx'
import CampaignView from './components/CampaignView.jsx'
import { clearPlayerSession, getPlayerSession } from './lib/auth.js'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import './App.scss'

const isAdminPath = typeof window !== 'undefined' && window.location.pathname === '/admin'

function App() {
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [playerSession, setPlayerSession] = useState(() => getPlayerSession())

  function logOut() {
    clearPlayerSession()
    setPlayerSession(null)
    setSelectedCampaign(null)
  }

  let content

  if (!isSupabaseConfigured) {
    content = (
      <div className="setup-notice panel">
        <h2>Supabase isn&rsquo;t configured yet</h2>
        <p>
          Copy <code>.env.example</code> to <code>.env</code>, add your
          Supabase project&rsquo;s URL and anon key, then restart the dev
          server. See <code>README.md</code> for the full setup steps.
        </p>
      </div>
    )
  } else if (selectedCampaign) {
    content = (
      <CampaignView
        campaignId={selectedCampaign.id}
        campaignName={selectedCampaign.name}
        onBack={() => setSelectedCampaign(null)}
      />
    )
  } else if (isAdminPath) {
    content = <AdminGate onOpenCampaign={setSelectedCampaign} />
  } else if (!playerSession) {
    content = <PlayerLogin onLoggedIn={setPlayerSession} />
  } else {
    content = (
      <PlayerDashboard
        playerId={playerSession.playerId}
        username={playerSession.username}
        onOpenCampaign={setSelectedCampaign}
        onLogOut={logOut}
      />
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Adventurer&rsquo;s Log</h1>
        <p className="app__subtitle">Dungeons &amp; Dragons campaign notes</p>
      </header>
      {content}
    </div>
  )
}

export default App
