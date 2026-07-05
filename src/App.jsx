import { useState } from 'react'
import TabNav from './components/TabNav.jsx'
import MapsTab from './components/MapsTab.jsx'
import NpcsTab from './components/NpcsTab.jsx'
import LootTab from './components/LootTab.jsx'
import './App.scss'

const TABS = [
  { id: 'maps', label: 'Maps' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'loot', label: 'Loot' },
]

function App() {
  const [activeTab, setActiveTab] = useState('maps')

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Adventurer&rsquo;s Log</h1>
        <p className="app__subtitle">Dungeons &amp; Dragons campaign notes</p>
      </header>

      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      <main className="app__content">
        {activeTab === 'maps' && <MapsTab />}
        {activeTab === 'npcs' && <NpcsTab />}
        {activeTab === 'loot' && <LootTab />}
      </main>
    </div>
  )
}

export default App
