import { useEffect, useRef, useState } from 'react'
import TabNav from './TabNav.jsx'
import MapsTab from './MapsTab.jsx'
import LoreTab from './LoreTab.jsx'
import PartyTab from './PartyTab.jsx'
import NpcsTab from './NpcsTab.jsx'
import LootTab from './LootTab.jsx'
import QuestsTab from './QuestsTab.jsx'
import SessionNotesTab from './SessionNotesTab.jsx'
import SpellsTab from './SpellsTab.jsx'
import ToolsTab from './ToolsTab.jsx'
import CustomTab from './CustomTab.jsx'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import './CampaignView.scss'

const BUILT_IN_TABS = [
  { id: 'sessions', label: 'Session Notes', icon: '📖' },
  { id: 'spells', label: 'Spells', icon: '✨' },
  { id: 'party', label: 'Party', icon: '🎭' },
  { id: 'maps', label: 'Maps', icon: '🗺️' },
  { id: 'loot', label: 'Loot', icon: '💰' },
  { id: 'quests', label: 'Quests', icon: '⚔️' },
  { id: 'npcs', label: 'NPCs', icon: '👥' },
  { id: 'lore', label: 'Lore', icon: '📔' },
  { id: 'tools', label: 'Tools', icon: '🛠️' },
]

const customTabPrefix = 'custom:'

const fromCustomTabRow = (r) => ({ id: r.id, name: r.name })

function CampaignView({ campaignId, campaignName, playerId, username, onBack, onLogOut }) {
  const [activeTab, setActiveTab] = useState('sessions')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const searchInputRef = useRef(null)
  const accountMenuRef = useRef(null)

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
    ...customTabs.map((tab) => ({ id: `${customTabPrefix}${tab.id}`, label: tab.name, icon: '📄' })),
  ]

  const searchResults =
    searchQuery.trim() === ''
      ? []
      : tabs.filter((tab) => tab.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))

  // Cmd/Ctrl+K focuses the tab search, same shortcut the input itself
  // advertises.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Closes the account menu on any click outside it, the standard
  // dropdown-dismissal pattern — there's no other dropdown in this app to
  // share the behavior with.
  useEffect(() => {
    if (!accountMenuOpen) return
    function onDocClick(e) {
      if (!accountMenuRef.current?.contains(e.target)) setAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDocClick)
    return () => document.removeEventListener('pointerdown', onDocClick)
  }, [accountMenuOpen])

  function goToTab(tabId) {
    setActiveTab(tabId)
    setSearchQuery('')
    searchInputRef.current?.blur()
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    if (searchResults.length > 0) goToTab(searchResults[0].id)
  }

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
      <div className="campaign-view__topbar">
        <button
          type="button"
          className="campaign-view__hamburger"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-pressed={sidebarOpen}
        >
          &#9776;
        </button>

        <form className="campaign-view__search" onSubmit={handleSearchSubmit} role="search">
          <span className="campaign-view__search-icon" aria-hidden="true">
            &#128269;
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tabs..."
            aria-label="Search tabs"
          />
          <kbd className="campaign-view__search-hint">&#8984;K</kbd>
          {searchResults.length > 0 && (
            <ul className="campaign-view__search-results">
              {searchResults.map((tab) => (
                <li key={tab.id}>
                  <button type="button" onClick={() => goToTab(tab.id)}>
                    <span aria-hidden="true">{tab.icon}</span> {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="campaign-view__account" ref={accountMenuRef}>
          <button
            type="button"
            className="campaign-view__avatar"
            onClick={() => setAccountMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={accountMenuOpen}
            aria-label="Account menu"
          >
            {username?.[0]?.toUpperCase() || '?'}
          </button>
          {accountMenuOpen && (
            <div className="campaign-view__account-menu panel">
              {username && <div className="campaign-view__account-name">{username}</div>}
              <button
                type="button"
                className="btn btn--text"
                onClick={() => {
                  setAccountMenuOpen(false)
                  onLogOut?.()
                }}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`campaign-view__body${sidebarOpen ? '' : ' campaign-view__body--sidebar-collapsed'}`}>
        {sidebarOpen && (
          <aside className="campaign-view__sidebar">
            <button type="button" className="btn btn--text campaign-view__back" onClick={onBack}>
              &larr; All Campaigns
            </button>

            <div className="campaign-view__title-block">
              <h2 className="campaign-view__name">{campaignName}</h2>
              <span className="campaign-view__status">Campaign Active</span>
            </div>

            <TabNav
              tabs={tabs}
              activeTab={activeTab}
              onSelect={setActiveTab}
              onAddTab={handleAddTab}
              className="tab-nav--sidebar"
              vertical
            />
          </aside>
        )}

        <div className="campaign-view__content">
          {activeTab === 'sessions' && (
            <SessionNotesTab campaignId={campaignId} playerId={playerId} />
          )}
          {activeTab === 'spells' && <SpellsTab campaignId={campaignId} playerId={playerId} />}
          {activeTab === 'party' && <PartyTab campaignId={campaignId} playerId={playerId} />}
          {activeTab === 'maps' && <MapsTab campaignId={campaignId} />}
          {activeTab === 'loot' && <LootTab campaignId={campaignId} />}
          {activeTab === 'quests' && <QuestsTab campaignId={campaignId} />}
          {activeTab === 'npcs' && <NpcsTab campaignId={campaignId} />}
          {activeTab === 'lore' && <LoreTab campaignId={campaignId} />}
          {activeTab === 'tools' && <ToolsTab campaignId={campaignId} playerId={playerId} />}
          {activeCustomTab && (
            <CustomTab
              key={activeCustomTab.id}
              tabId={activeCustomTab.id}
              tabName={activeCustomTab.name}
              onRename={(name) => handleRenameTab(activeCustomTab.id, name)}
              onDelete={() => handleDeleteTab(activeCustomTab.id)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default CampaignView
