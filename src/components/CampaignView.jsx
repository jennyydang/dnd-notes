import { useCallback, useEffect, useState } from 'react'
import TabNav from './TabNav.jsx'
import MapsTab from './MapsTab.jsx'
import LoreTab from './LoreTab.jsx'
import PartyTab from './PartyTab.jsx'
import NpcsTab from './NpcsTab.jsx'
import LootTab from './LootTab.jsx'
import QuestsTab from './QuestsTab.jsx'
import SessionNotesTab from './SessionNotesTab.jsx'
import TimelineTab from './TimelineTab.jsx'
import SpellsTab from './SpellsTab.jsx'
import ToolsTab from './ToolsTab.jsx'
import CustomTab from './CustomTab.jsx'
import HomeHub from './HomeHub.jsx'
import SessionMode from './SessionMode.jsx'
import CharacterTab from './CharacterTab.jsx'
import PrepTab from './PrepTab.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import EntityDetailModal from './EntityDetailModal.jsx'
import QuickCreateModal from './QuickCreateModal.jsx'
import AccountMenu from './AccountMenu.jsx'
import FeedbackForm from './FeedbackForm.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import QuickView from './QuickView.jsx'
import Modal from './Modal.jsx'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { CampaignNavContext } from '../hooks/useCampaignData.js'
import CampaignDataProvider from './CampaignDataProvider.jsx'
import { getStored, setStored } from '../lib/sessionMode.js'
import './CampaignView.scss'

// Every built-in screen, grouped into the five primary areas. The areas
// are the bottom bar on phones and the sidebar groups on wider screens;
// an area with more than one screen shows them as a row of pills.
const TAB_DEFS = {
  home: { label: 'Home', icon: '🏠' },
  session: { label: 'Session Mode', icon: '🎲' },
  tools: { label: 'Tools', icon: '🛠️' },
  sessions: { label: 'Session Notes', icon: '📖' },
  timeline: { label: 'Timeline', icon: '⏳' },
  npcs: { label: 'NPCs', icon: '👥' },
  maps: { label: 'Maps & Places', icon: '🗺️' },
  quests: { label: 'Quests', icon: '⚔️' },
  loot: { label: 'Loot', icon: '💰' },
  lore: { label: 'Lore & Clues', icon: '📔' },
  character: { label: 'Character Sheet', icon: '🎭' },
  spells: { label: 'Spells', icon: '✨' },
  party: { label: 'Party', icon: '🛡️' },
  prep: { label: 'Session Prep', icon: '🗒️' },
}

const AREAS = [
  { id: 'home', label: 'Home', icon: '🏠', tabs: ['home'] },
  { id: 'session', label: 'Session', icon: '🎲', tabs: ['session', 'tools'] },
  {
    id: 'journal',
    label: 'Journal',
    icon: '📖',
    tabs: ['sessions', 'timeline', 'npcs', 'maps', 'quests', 'loot', 'lore'],
    custom: true,
  },
  { id: 'character', label: 'Character', icon: '🎭', tabs: ['character', 'spells', 'party'] },
  { id: 'prep', label: 'Prep', icon: '🗒️', tabs: ['prep'] },
]

const customTabPrefix = 'custom:'

const fromCustomTabRow = (r) => ({
  id: r.id,
  name: r.name,
  isPrivate: r.is_private,
  createdBy: r.created_by,
})

const lastTabKey = (campaignId) => `dnd-notes-last-tab:${campaignId}`

function CampaignView({ campaignId, campaignName, playerId, username, onBack, onLogOut }) {
  // Reopen where the player left off in this campaign (survives refresh).
  const [activeTab, setActiveTabState] = useState(() => getStored(lastTabKey(campaignId), 'home'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [detailStack, setDetailStack] = useState([])
  const [quickCreate, setQuickCreate] = useState(null)
  const [addRequest, setAddRequest] = useState(null)

  const {
    items: customTabs,
    addItem: addCustomTab,
    updateItem: updateCustomTab,
    removeItem: removeCustomTab,
  } = useSupabaseTable('custom_tabs', {
    fromRow: fromCustomTabRow,
    filters: { campaign_id: campaignId },
  })

  // A private tab is visible only to whoever made it — everyone else's
  // client just never renders a tab for it. The admin has no playerId, so
  // (like every other "private to a player" feature in this app) it falls
  // back to seeing everything rather than being scoped to nobody.
  const visibleCustomTabs = customTabs.filter(
    (tab) => !tab.isPrivate || !playerId || tab.createdBy === playerId,
  )
  const customTabItems = visibleCustomTabs.map((tab) => ({
    id: `${customTabPrefix}${tab.id}`,
    label: tab.name,
    icon: tab.isPrivate ? '🔒' : '📄',
  }))

  const areaTabs = (area) => [
    ...area.tabs.map((id) => ({ id, ...TAB_DEFS[id] })),
    ...(area.custom ? customTabItems : []),
  ]
  const allTabs = AREAS.flatMap(areaTabs)

  const setActiveTab = useCallback(
    (tab) => {
      setActiveTabState(tab)
      setStored(lastTabKey(campaignId), tab)
      window.scrollTo({ top: 0 })
    },
    [campaignId],
  )

  // Falls back to Home if the remembered tab no longer exists (e.g. a
  // custom tab someone deleted).
  const knownTab =
    TAB_DEFS[activeTab] || customTabItems.some((t) => t.id === activeTab) ? activeTab : 'home'
  const activeArea =
    AREAS.find((area) => areaTabs(area).some((t) => t.id === knownTab)) || AREAS[0]

  // Cmd/Ctrl+K opens global search from anywhere in the campaign.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleAddTab(name, isPrivate) {
    const created = await addCustomTab({
      name,
      is_private: isPrivate,
      created_by: playerId || null,
    })
    setActiveTab(`${customTabPrefix}${created.id}`)
  }

  async function handleRenameTab(tabId, name) {
    await updateCustomTab(tabId, { name })
  }

  async function handleDeleteTab(tabId) {
    await removeCustomTab(tabId)
    setActiveTab('sessions')
  }

  const activeCustomTabId = knownTab.startsWith(customTabPrefix)
    ? knownTab.slice(customTabPrefix.length)
    : null
  const activeCustomTab = visibleCustomTabs.find((tab) => tab.id === activeCustomTabId)

  const nav = {
    goTo: (tab, options = {}) => {
      setDetailStack([])
      setSearchOpen(false)
      setActiveTab(tab)
      if (options.add) setAddRequest({ tab, at: Date.now() })
    },
    openEntity: (type, id) => setDetailStack((stack) => [...stack, { type, id }]),
    openSearch: () => setSearchOpen(true),
    openQuickCreate: (type = 'npc', initial = {}) => setQuickCreate({ type, initial }),
    tabs: allTabs,
  }
  const addRequestFor = (tab) => (addRequest?.tab === tab ? addRequest.at : null)

  const topDetail = detailStack[detailStack.length - 1]

  return (
    <CampaignDataProvider campaignId={campaignId} playerId={playerId}>
      <CampaignNavContext.Provider value={nav}>
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
            <button
              type="button"
              className="btn btn--text campaign-view__mobile-back"
              onClick={onBack}
            >
              &larr; Campaigns
            </button>

            <button
              type="button"
              className="campaign-view__search"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the campaign"
            >
              <span className="campaign-view__search-icon" aria-hidden="true">
                &#128269;
              </span>
              <span className="campaign-view__search-placeholder">
                Search NPCs, places, quests, notes…
              </span>
              <kbd className="campaign-view__search-hint">&#8984;K</kbd>
            </button>

            <AccountMenu
              username={username}
              onOpenSettings={() => setShowSettings(true)}
              onSendFeedback={() => setShowFeedback(true)}
              onLogOut={onLogOut}
            />
          </div>

          {showFeedback && (
            <Modal onClose={() => setShowFeedback(false)} label="Send Feedback">
              <FeedbackForm onDone={() => setShowFeedback(false)} />
            </Modal>
          )}

          {showSettings && (
            <Modal onClose={() => setShowSettings(false)} label="Settings">
              <SettingsPanel onDone={() => setShowSettings(false)} />
            </Modal>
          )}

          {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

          {topDetail && (
            <EntityDetailModal
              key={`${topDetail.type}:${topDetail.id}`}
              type={topDetail.type}
              id={topDetail.id}
              canGoBack={detailStack.length > 1}
              onBack={() => setDetailStack((stack) => stack.slice(0, -1))}
              onClose={() => setDetailStack([])}
            />
          )}

          {quickCreate && (
            <QuickCreateModal
              initialType={quickCreate.type}
              initial={quickCreate.initial}
              onClose={() => setQuickCreate(null)}
            />
          )}

          <div
            className={`campaign-view__body${sidebarOpen ? '' : ' campaign-view__body--sidebar-collapsed'}`}
          >
            {sidebarOpen && (
              <aside className="campaign-view__sidebar" aria-label="Campaign navigation">
                <button type="button" className="btn btn--text campaign-view__back" onClick={onBack}>
                  &larr; All Campaigns
                </button>

                <div className="campaign-view__title-block">
                  <h2 className="campaign-view__name">{campaignName}</h2>
                </div>

                {AREAS.map((area) => (
                  <div className="campaign-view__group" key={area.id}>
                    {area.tabs.length > 1 && (
                      <h3 className="campaign-view__group-label">{area.label}</h3>
                    )}
                    <TabNav
                      tabs={areaTabs(area)}
                      activeTab={knownTab}
                      onSelect={setActiveTab}
                      onAddTab={area.custom ? handleAddTab : undefined}
                      className="tab-nav--sidebar"
                      label={`${area.label} sections`}
                      vertical
                    />
                  </div>
                ))}
              </aside>
            )}

            <div className="campaign-view__content">
              {knownTab !== 'home' && <h2 className="campaign-view__mobile-title">{campaignName}</h2>}
              {areaTabs(activeArea).length > 1 && (
                <TabNav
                  tabs={areaTabs(activeArea)}
                  activeTab={knownTab}
                  onSelect={setActiveTab}
                  onAddTab={activeArea.custom ? handleAddTab : undefined}
                  className="tab-nav--pill campaign-view__subnav"
                  label={`${activeArea.label} sections`}
                />
              )}

              {knownTab === 'home' && <HomeHub campaignName={campaignName} />}
              {knownTab === 'session' && <SessionMode />}
              {knownTab === 'prep' && <PrepTab />}
              {knownTab === 'character' && <CharacterTab />}
              {knownTab === 'sessions' && (
                <SessionNotesTab
                  campaignId={campaignId}
                  playerId={playerId}
                  onOpenTab={setActiveTab}
                  addRequest={addRequestFor('sessions')}
                />
              )}
              {knownTab === 'timeline' && <TimelineTab campaignId={campaignId} playerId={playerId} />}
              {knownTab === 'spells' && <SpellsTab campaignId={campaignId} playerId={playerId} />}
              {knownTab === 'party' && <PartyTab campaignId={campaignId} playerId={playerId} />}
              {knownTab === 'maps' && <MapsTab campaignId={campaignId} />}
              {knownTab === 'loot' && <LootTab campaignId={campaignId} />}
              {knownTab === 'quests' && <QuestsTab campaignId={campaignId} />}
              {knownTab === 'npcs' && <NpcsTab campaignId={campaignId} />}
              {knownTab === 'lore' && <LoreTab campaignId={campaignId} />}
              {knownTab === 'tools' && <ToolsTab campaignId={campaignId} playerId={playerId} />}
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

          <nav className="bottom-nav" aria-label="Primary">
            {AREAS.map((area) => {
              const active = area.id === activeArea.id
              return (
                <button
                  key={area.id}
                  type="button"
                  className={`bottom-nav__item${active ? ' bottom-nav__item--active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(active ? knownTab : area.tabs[0])}
                >
                  <span className="bottom-nav__icon" aria-hidden="true">
                    {area.icon}
                  </span>
                  <span className="bottom-nav__label">{area.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Home and Session Mode already have quick capture, so the
              floating widget only shows elsewhere. */}
          {playerId && !['home', 'session'].includes(activeArea.id) && (
            <QuickView campaignId={campaignId} playerId={playerId} />
          )}
        </div>
      </CampaignNavContext.Provider>
    </CampaignDataProvider>
  )
}

export default CampaignView
