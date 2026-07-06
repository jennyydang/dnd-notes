import { useState } from 'react'
import TabNav from './TabNav.jsx'
import MapsTab from './MapsTab.jsx'
import LoreTab from './LoreTab.jsx'
import PartyTab from './PartyTab.jsx'
import NpcsTab from './NpcsTab.jsx'
import LootTab from './LootTab.jsx'
import QuestsTab from './QuestsTab.jsx'
import SessionNotesTab from './SessionNotesTab.jsx'
import CustomTab from './CustomTab.jsx'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './CampaignView.scss'

const BUILT_IN_TABS = [
  { id: 'sessions', label: 'Session Notes' },
  { id: 'party', label: 'Party' },
  { id: 'maps', label: 'Maps' },
  { id: 'loot', label: 'Loot' },
  { id: 'quests', label: 'Quests' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'lore', label: 'Lore' },
]

const customTabPrefix = 'custom:'

const fromCustomTabRow = (r) => ({ id: r.id, name: r.name })

function CampaignView({ campaignId, campaignName, playerId, onBack }) {
  const [activeTab, setActiveTab] = useState('sessions')
  const {
    items: customTabs,
    addItem: addCustomTab,
    updateItem: updateCustomTab,
    removeItem: removeCustomTab,
  } = useSupabaseTable('custom_tabs', {
    fromRow: fromCustomTabRow,
    filters: { campaign_id: campaignId },
  })

  const tabs = [
    ...BUILT_IN_TABS,
    ...customTabs.map((tab) => ({ id: `${customTabPrefix}${tab.id}`, label: tab.name })),
  ]

  async function handleAddTab(name) {
    const created = await addCustomTab({ name })
    setActiveTab(`${customTabPrefix}${created.id}`)
  }

  async function handleRenameTab(tabId, name) {
    await updateCustomTab(tabId, { name })
  }

  async function handleDeleteTab(tabId) {
    await removeCustomTab(tabId)
    setActiveTab('sessions')
  }

  const activeCustomTabId = activeTab.startsWith(customTabPrefix)
    ? activeTab.slice(customTabPrefix.length)
    : null
  const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId)

  return (
    <div className="campaign-view">
      <div className="campaign-view__header">
        <button type="button" className="btn btn--text" onClick={onBack}>
          &larr; All Campaigns
        </button>
        <h2 className="campaign-view__name">{campaignName}</h2>
      </div>

      <TabNav tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} onAddTab={handleAddTab} />

      <main className="app__content">
        {activeTab === 'sessions' && (
          <SessionNotesTab campaignId={campaignId} playerId={playerId} />
        )}
        {activeTab === 'party' && <PartyTab campaignId={campaignId} playerId={playerId} />}
        {activeTab === 'maps' && <MapsTab campaignId={campaignId} />}
        {activeTab === 'loot' && <LootTab campaignId={campaignId} />}
        {activeTab === 'quests' && <QuestsTab campaignId={campaignId} />}
        {activeTab === 'npcs' && <NpcsTab campaignId={campaignId} />}
        {activeTab === 'lore' && <LoreTab campaignId={campaignId} />}
        {activeCustomTab && (
          <CustomTab
            key={activeCustomTab.id}
            tabId={activeCustomTab.id}
            tabName={activeCustomTab.name}
            onRename={(name) => handleRenameTab(activeCustomTab.id, name)}
            onDelete={() => handleDeleteTab(activeCustomTab.id)}
          />
        )}
      </main>
    </div>
  )
}

export default CampaignView
