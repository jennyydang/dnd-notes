import { useState } from 'react'
import TabNav from './components/TabNav.jsx'
import MapsTab from './components/MapsTab.jsx'
import PartyTab from './components/PartyTab.jsx'
import NpcsTab from './components/NpcsTab.jsx'
import LootTab from './components/LootTab.jsx'
import QuestsTab from './components/QuestsTab.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import './App.scss'

const TABS = [
  { id: 'maps', label: 'Maps' },
  { id: 'party', label: 'Party' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'loot', label: 'Loot' },
  { id: 'quests', label: 'Quests' },
]

function App() {
  const [activeTab, setActiveTab] = useState('maps')

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Adventurer&rsquo;s Log</h1>
        <p className="app__subtitle">Dungeons &amp; Dragons campaign notes</p>
      </header>

      {isSupabaseConfigured ? (
        <>
          <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

          <main className="app__content">
            {activeTab === 'maps' && <MapsTab />}
            {activeTab === 'party' && <PartyTab />}
            {activeTab === 'npcs' && <NpcsTab />}
            {activeTab === 'loot' && <LootTab />}
            {activeTab === 'quests' && <QuestsTab />}
          </main>
        </>
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
