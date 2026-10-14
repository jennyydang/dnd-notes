import { useCallback, useEffect, useState } from 'react'
import TabNav from './TabNav.jsx'
import MapsTab from './MapsTab.jsx'
import LoreTab from './LoreTab.jsx'
import PartyTab from './PartyTab.jsx'
import NpcsTab from './NpcsTab.jsx'
import CreaturesTab from './CreaturesTab.jsx'
import SecretNpcsTab from './SecretNpcsTab.jsx'
import ArtGallery from './ArtGallery.jsx'
import DmMapsTab from './DmMapsTab.jsx'
import DmCreaturesTab from './DmCreaturesTab.jsx'
import { NotificationBell } from './DmSharesInbox.jsx'
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
import { PartyPresence, SyncStatus } from './LiveStatus.jsx'
import SessionDock from './session/SessionDock.jsx'
import TurnAlert from './session/TurnAlert.jsx'
import { CombatBadge, CombatMode } from './session/CombatMode.jsx'
import RevealOverlay from './RevealOverlay.jsx'
import DownedPulse from './session/DownedPulse.jsx'
import LevelUp from './session/LevelUp.jsx'
import InitiativeTracker from './session/InitiativeTracker.jsx'
import DmPlayersTab from './DmPlayersTab.jsx'
import FeedbackForm from './FeedbackForm.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import Modal from './Modal.jsx'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { CampaignNavContext } from '../hooks/useCampaignData.js'
import CampaignDataProvider from './CampaignDataProvider.jsx'
import { getStored, setStored } from '../lib/sessionMode.js'
import Icon from './Icon.jsx'
import './CampaignView.scss'

// Every built-in screen, grouped into the five primary areas. The areas
// are the bottom bar on phones and the sidebar groups on wider screens;
// an area with more than one screen shows them as a row of pills.
const TAB_DEFS = {
  home: { label: 'Home', icon: 'home' },
  session: { label: 'Session Mode', icon: 'dice' },
  tools: { label: 'Tools', icon: 'tools' },
  sessions: { label: 'Session Notes', icon: 'book' },
  timeline: { label: 'Timeline', icon: 'hourglass' },
  npcs: { label: 'NPCs', icon: 'users' },
  creatures: { label: 'Monsters & Creatures', icon: 'monster' },
  art: { label: 'Art', icon: 'image' },
  maps: { label: 'Maps & Places', icon: 'map' },
  quests: { label: 'Quests', icon: 'quest' },
  loot: { label: 'Loot', icon: 'coins' },
  lore: { label: 'Lore & Clues', icon: 'lore' },
  character: { label: 'Character Sheet', icon: 'character' },
  spells: { label: 'Spells', icon: 'spell' },
  party: { label: 'Party', icon: 'shield' },
  prep: { label: 'Session Prep', icon: 'prep' },
  'dm-npcs': { label: 'NPCs', icon: 'users' },
  'dm-art': { label: 'Art', icon: 'image' },
  'dm-maps': { label: 'Maps', icon: 'map' },
  'dm-creatures': { label: 'Monsters', icon: 'monster' },
  'dm-combat': { label: 'Combat', icon: 'quest' },
  'dm-players': { label: 'Players', icon: 'shield' },
}

const AREAS = [
  { id: 'home', label: 'Home', icon: 'home', tabs: ['home'] },
  { id: 'session', label: 'Session', icon: 'dice', tabs: ['session', 'tools'] },
  {
    id: 'journal',
    label: 'Journal',
    icon: 'book',
    tabs: ['sessions', 'timeline', 'npcs', 'creatures', 'maps', 'quests', 'loot', 'lore', 'art'],
    custom: true,
  },
  { id: 'character', label: 'Character', icon: 'character', tabs: ['character', 'spells', 'party'] },
  { id: 'prep', label: 'Prep', icon: 'prep', tabs: ['prep'] },
  // The admin's view of the DM tools (DMs themselves get DM_AREAS).
  { id: 'dm', label: 'DM', icon: 'eye', tabs: ['dm-players', 'dm-npcs', 'dm-creatures', 'dm-art', 'dm-maps'], dmOnly: true },
]

// A DM's whole view of the campaign: just their private NPCs, monsters, art and maps,
// each with a Share button that notifies the players.
const DM_AREAS = [
  // Who's in the campaign, their characters, and sign-up invite links.
  { id: 'dm-players', label: 'Players', icon: 'shield', tabs: ['dm-players'] },
  { id: 'dm-npcs', label: 'NPCs', icon: 'users', tabs: ['dm-npcs'] },
  { id: 'dm-creatures', label: 'Monsters', icon: 'monster', tabs: ['dm-creatures'] },
  { id: 'dm-art', label: 'Art', icon: 'image', tabs: ['dm-art'] },
  { id: 'dm-maps', label: 'Maps', icon: 'map', tabs: ['dm-maps'] },
  // The shared initiative tracker, so the DM can run turn order.
  { id: 'dm-combat', label: 'Combat', icon: 'quest', tabs: ['dm-combat'] },
]

const NO_PLAYER = '00000000-0000-0000-0000-000000000000'
const membershipFromRow = (r) => ({ id: r.id, role: r.role })

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
    icon: tab.isPrivate ? 'lock' : 'file',
  }))

  // Players marked DM in this campaign (creating it isn't enough) see only
  // the DM tools. The admin account has no player, so (as elsewhere) it
  // sees everything, DM tools included.
  const { items: memberships, loading: roleLoading } = useSupabaseTable('campaign_memberships', {
    fromRow: membershipFromRow,
    orderBy: 'name',
    filters: { id: campaignId, player_id: playerId || NO_PLAYER },
  })
  const isDm = !playerId || memberships.some((m) => m.role === 'dm')
  const dmView = Boolean(playerId) && isDm
  // Hold the screen until the role is known, so a DM doesn't see the
  // player layout flash first.
  const roleReady = !playerId || !roleLoading
  const areas = dmView ? DM_AREAS : AREAS.filter((area) => !area.dmOnly || isDm)
  const homeTab = dmView ? 'dm-npcs' : 'home'

  const areaTabs = (area) => [
    ...area.tabs.map((id) => ({ id, ...TAB_DEFS[id] })),
    ...(area.custom ? customTabItems : []),
  ]
  const allTabs = areas.flatMap(areaTabs)

  const setActiveTab = useCallback(
    (tab) => {
      setActiveTabState(tab)
      setStored(lastTabKey(campaignId), tab)
      window.scrollTo({ top: 0 })
    },
    [campaignId],
  )

  // Falls back to Home if the remembered tab no longer exists (e.g. a
  // custom tab someone deleted) or isn't this player's to see. While the
  // role is still loading, a remembered DM tab is held rather than lost.
  const knownTab =
    allTabs.some((t) => t.id === activeTab) || (roleLoading && TAB_DEFS[activeTab]) ? activeTab : homeTab
  const activeArea =
    areas.find((area) => areaTabs(area).some((t) => t.id === knownTab)) || areas[0]

  // Which way the page turns when you switch tabs: forward when moving
  // to a later tab in the nav, back when moving to an earlier one.
  // Set once per tab change (during render, React's "adjust state when a
  // prop changes" pattern) so the class never flips mid-animation.
  const tabIndex = allTabs.findIndex((t) => t.id === knownTab)
  const [pageTurn, setPageTurn] = useState({ tab: knownTab, index: tabIndex, dir: 'forward' })
  if (pageTurn.tab !== knownTab) {
    setPageTurn({ tab: knownTab, index: tabIndex, dir: tabIndex < pageTurn.index ? 'back' : 'forward' })
  }
  const turn = pageTurn.dir

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
    isDm,
  }
  const addRequestFor = (tab) => (addRequest?.tab === tab ? addRequest.at : null)

  const topDetail = detailStack[detailStack.length - 1]

  return (
    <CampaignDataProvider campaignId={campaignId} playerId={playerId}>
      <CampaignNavContext.Provider value={nav}>
        <div className="campaign-view">
          <div className="campaign-view__topbar">
            <div className="campaign-view__topbar-start">
              <button
                type="button"
                className="campaign-view__hamburger"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                aria-pressed={sidebarOpen}
              >
                <Icon name="menu" />
              </button>
              <button
                type="button"
                className="btn btn--text campaign-view__mobile-back"
                onClick={onBack}
              >
                &larr; Campaigns
              </button>
            </div>

            {dmView ? (
              <span className="campaign-view__search-spacer" />
            ) : (
              <button
                type="button"
                className="campaign-view__search"
                onClick={() => setSearchOpen(true)}
                aria-label="Search the campaign"
              >
                <span className="campaign-view__search-icon" aria-hidden="true">
                  <Icon name="search" />
                </span>
                <span className="campaign-view__search-placeholder">
                  Search NPCs, places, quests, notes…
                </span>
                <kbd className="campaign-view__search-hint">&#8984;K</kbd>
              </button>
            )}

            <div className="campaign-view__topbar-end">
              {roleReady && <CombatBadge target={dmView ? 'dm-combat' : 'session'} />}
              <SyncStatus />
              <PartyPresence campaignId={campaignId} playerId={playerId} username={username} />

              {playerId && roleReady && (
                <NotificationBell playerId={playerId} campaignId={campaignId} dmShares={!isDm} />
              )}

              <AccountMenu
                playerId={playerId}
                username={username}
                onOpenSettings={() => setShowSettings(true)}
                onSendFeedback={() => setShowFeedback(true)}
                onLogOut={onLogOut}
              />
            </div>
          </div>

          {showFeedback && (
            <Modal onClose={() => setShowFeedback(false)} label="Send Feedback">
              <FeedbackForm playerId={playerId} onDone={() => setShowFeedback(false)} />
            </Modal>
          )}

          {showSettings && (
            <Modal onClose={() => setShowSettings(false)} label="Settings">
              <SettingsPanel onDone={() => setShowSettings(false)} />
            </Modal>
          )}

          {searchOpen && !dmView && <GlobalSearch onClose={() => setSearchOpen(false)} />}

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

          {/* Home and Session Mode have their own quick add and session controls. */}
          {!dmView && <SessionDock hidden={knownTab === 'home' || knownTab === 'session'} />}
          {roleReady && <TurnAlert />}
          {/* Combat theme for everyone; the shake-and-roll alert is for players. */}
          {roleReady && <CombatMode showAlert={Boolean(playerId) && !isDm} />}
          {/* Players see the DM's live reveals; the DM is the one sending them. */}
          {playerId && roleReady && !isDm && <RevealOverlay campaignId={campaignId} />}
          {/* A heartbeat at the screen edges while your character is dying. */}
          {playerId && roleReady && !isDm && <DownedPulse />}
          {/* Celebrates a party member's level going up, for everyone. */}
          {roleReady && <LevelUp />}

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

                {roleReady && areas.map((area) => (
                  <div className="campaign-view__group" key={area.id}>
                    {area.tabs.length > 1 && (
                      <h3 className="campaign-view__group-label">{area.label}</h3>
                    )}
                    <TabNav
                      tabs={areaTabs(area)}
                      activeTab={knownTab}
                      onSelect={setActiveTab}
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

              {!roleReady && <p className="empty-state">Loading…</p>}
              {/* Keyed per screen so each one fades in when you switch to it. */}
              {roleReady && (
              <div key={knownTab} className={`campaign-view__screen campaign-view__screen--${turn}`}>
              {knownTab === 'home' && <HomeHub campaignName={campaignName} />}
              {knownTab === 'session' && <SessionMode campaignName={campaignName} />}
              {knownTab === 'prep' && <PrepTab />}
              {knownTab === 'character' && <CharacterTab />}
              {knownTab === 'sessions' && (
                <SessionNotesTab
                  campaignId={campaignId}
                  campaignName={campaignName}
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
              {knownTab === 'creatures' && <CreaturesTab campaignId={campaignId} />}
              {knownTab === 'lore' && <LoreTab campaignId={campaignId} />}
              {knownTab === 'art' && <ArtGallery campaignId={campaignId} />}
              {isDm && knownTab === 'dm-npcs' && (
                <SecretNpcsTab campaignId={campaignId} addRequest={addRequestFor('dm-npcs')} />
              )}
              {isDm && knownTab === 'dm-art' && <ArtGallery campaignId={campaignId} manage />}
              {isDm && knownTab === 'dm-maps' && <DmMapsTab campaignId={campaignId} />}
              {isDm && knownTab === 'dm-creatures' && <DmCreaturesTab campaignId={campaignId} />}
              {isDm && knownTab === 'dm-players' && <DmPlayersTab campaignName={campaignName} />}
              {isDm && knownTab === 'dm-combat' && (
                <div className="campaign-view__combat">
                  <InitiativeTracker />
                </div>
              )}
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
              )}
            </div>
          </div>

          <nav className="bottom-nav" aria-label="Primary">
            {roleReady && areas.map((area) => {
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
                    <Icon name={area.icon} />
                  </span>
                  <span className="bottom-nav__label">{area.label}</span>
                </button>
              )
            })}
          </nav>

        </div>
      </CampaignNavContext.Provider>
    </CampaignDataProvider>
  )
}

export default CampaignView
