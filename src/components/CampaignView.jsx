import { useState } from 'react'
import TabNav from './TabNav.jsx'
import MapsTab from './MapsTab.jsx'
import LoreTab from './LoreTab.jsx'
import PartyTab from './PartyTab.jsx'
import NpcsTab from './NpcsTab.jsx'
import LootTab from './LootTab.jsx'
import QuestsTab from './QuestsTab.jsx'
import SessionNotesTab from './SessionNotesTab.jsx'
import './CampaignView.scss'

const TABS = [
  { id: 'maps', label: 'Maps' },
  { id: 'lore', label: 'Lore' },
  { id: 'party', label: 'Party' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'loot', label: 'Loot' },
  { id: 'quests', label: 'Quests' },
  { id: 'sessions', label: 'Session Notes' },
]

function CampaignView({ campaignId, campaignName, onBack }) {
  const [activeTab, setActiveTab] = useState('maps')

  return (
    <div className="campaign-view">
      <div className="campaign-view__header">
        <button type="button" className="btn btn--text" onClick={onBack}>
          &larr; All Campaigns
        </button>
        <h2 className="campaign-view__name">{campaignName}</h2>
      </div>

      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      <main className="app__content">
        {activeTab === 'maps' && <MapsTab campaignId={campaignId} />}
        {activeTab === 'lore' && <LoreTab campaignId={campaignId} />}
        {activeTab === 'party' && <PartyTab campaignId={campaignId} />}
        {activeTab === 'npcs' && <NpcsTab campaignId={campaignId} />}
        {activeTab === 'loot' && <LootTab campaignId={campaignId} />}
        {activeTab === 'quests' && <QuestsTab campaignId={campaignId} />}
        {activeTab === 'sessions' && <SessionNotesTab campaignId={campaignId} />}
      </main>
    </div>
  )
}

export default CampaignView
