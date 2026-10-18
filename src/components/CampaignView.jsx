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
import WikiTab from './WikiTab.jsx'
import CustomTab from './CustomTab.jsx'
import HomeHub from './HomeHub.jsx'
import SessionMode from './SessionMode.jsx'
import CharacterTab from './CharacterTab.jsx'
import PrepTab from './PrepTab.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import RoutedEntry from './RoutedEntry.jsx'
import { ENTITY_TYPES } from '../lib/entities.js'
import QuickCreateModal from './QuickCreateModal.jsx'
import AccountMenu from './AccountMenu.jsx'
import { HereToo, PartyPresence, SyncStatus } from './LiveStatus.jsx'
import { usePartyPresence } from '../hooks/usePartyPresence.js'
import { usePlayerAvatar } from '../lib/profiles.js'
import SessionDock from './session/SessionDock.jsx'
import RecordingBar from './session/RecordingBar.jsx'
import TurnAlert from './session/TurnAlert.jsx'
import { PollPopup } from './session/Polls.jsx'
import RelationshipWeb from './RelationshipWeb.jsx'
import DmOverview from './DmOverview.jsx'
import { CombatBadge, CombatMode } from './session/CombatMode.jsx'
import RevealOverlay from './RevealOverlay.jsx'
import ShardAlert from './ShardAlert.jsx'
import DownedPulse from './session/DownedPulse.jsx'
import LevelUp from './session/LevelUp.jsx'
import PartyLevelUp from './session/PartyLevelUp.jsx'
import InitiativeTracker from './session/InitiativeTracker.jsx'
import DmPlayersTab from './DmPlayersTab.jsx'
import FeedbackForm from './FeedbackForm.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import Modal from './Modal.jsx'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { CampaignNavContext } from '../hooks/useCampaignData.js'
import CampaignDataProvider from './CampaignDataProvider.jsx'
import { getStored, setStored } from '../lib/sessionMode.js'
import { navigate, usePath } from '../lib/router.js'
import { campaignPath, parseRoute } from '../lib/routes.js'
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
  wiki: { label: 'World Wiki', icon: 'library' },
  timeline: { label: 'Timeline', icon: 'hourglass' },
  web: { label: 'Connections', icon: 'network' },
  npcs: { label: 'NPCs', icon: 'users' },
  creatures: { label: 'Creatures', icon: 'creature' },
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
  'dm-creatures': { label: 'Creatures', icon: 'creature' },
  'dm-combat': { label: 'Combat', icon: 'quest' },
  'dm-overview': { label: 'Party Overview', icon: 'compass' },
  'dm-players': { label: 'Players', icon: 'shield' },
}

const AREAS = [
  { id: 'home', label: 'Home', icon: 'home', tabs: ['home'] },
  { id: 'session', label: 'Session', icon: 'dice', tabs: ['session', 'tools'] },
  {
    id: 'journal',
    label: 'Journal',
    icon: 'book',
    tabs: ['sessions', 'timeline', 'web', 'npcs', 'creatures', 'maps', 'quests', 'loot', 'lore', 'art'],
    custom: true,
  },
  { id: 'character', label: 'Character', icon: 'character', tabs: ['character', 'spells', 'party'] },
  { id: 'prep', label: 'Prep', icon: 'prep', tabs: ['prep', 'wiki'] },
  // The admin's view of the DM tools (DMs themselves get DM_AREAS).
  { id: 'dm', label: 'DM', icon: 'eye', tabs: ['dm-overview', 'dm-players', 'dm-npcs', 'dm-creatures', 'dm-art', 'dm-maps'], dmOnly: true },
]

// A DM's whole view of the campaign: just their private NPCs, creatures, art and maps,
// each with a Reveal button that shows it to the players.
const DM_AREAS = [
  // What the party has pieced together, so the DM can follow along.
  { id: 'dm-overview', label: 'Overview', icon: 'compass', tabs: ['dm-overview'] },
  // Everything the party has written about the world, as a wiki.
  { id: 'dm-wiki', label: 'World Wiki', icon: 'library', tabs: ['wiki'] },
  // Who's in the campaign, their characters, and sign-up invite links.
  { id: 'dm-players', label: 'Players', icon: 'shield', tabs: ['dm-players'] },
  { id: 'dm-npcs', label: 'NPCs', icon: 'users', tabs: ['dm-npcs'] },
  { id: 'dm-creatures', label: 'Creatures', icon: 'creature', tabs: ['dm-creatures'] },
  { id: 'dm-art', label: 'Art', icon: 'image', tabs: ['dm-art'] },
  { id: 'dm-maps', label: 'Maps', icon: 'map', tabs: ['dm-maps'] },
  // The shared initiative tracker, so the DM can run turn order.
  { id: 'dm-combat', label: 'Combat', icon: 'quest', tabs: ['dm-combat'] },
  // Party votes, plus the shared calculators and trackers.
  { id: 'dm-tools', label: 'Tools', icon: 'tools', tabs: ['tools'] },
]

const NO_PLAYER = '00000000-0000-0000-0000-000000000000'
const membershipFromRow = (r) => ({ id: r.id, role: r.role, createdBy: r.created_by })

const customTabPrefix = 'custom:'

const fromCustomTabRow = (r) => ({
  id: r.id,
  name: r.name,
  isPrivate: r.is_private,
  createdBy: r.created_by,
})

const lastTabKey = (campaignId) => `dnd-notes-last-tab:${campaignId}`
const viewAsKey = (campaignId) => `dnd-notes-view-as:${campaignId}`

function CampaignView({ campaignId, campaignName, slug, admin = false, playerId, username, onBack, onLogOut }) {
  // The screen comes from the address (/c/anadoss/quests); without one,
  // reopen where the player left off in this campaign.
  const route = parseRoute(usePath())
  const [lastTab] = useState(() => getStored(lastTabKey(campaignId), 'home'))
  const activeTab = route.tab || lastTab
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Sidebar groups (Session, Journal, Character…) folded away, remembered.
  const [foldedGroups, setFoldedGroups] = useState(() => getStored('dnd-notes-sidebar-folded', []))
  function toggleGroup(id) {
    setFoldedGroups((all) => {
      const next = all.includes(id) ? all.filter((g) => g !== id) : [...all, id]
      setStored('dnd-notes-sidebar-folded', next)
      return next
    })
  }
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickCreate, setQuickCreate] = useState(null)
  const [addRequest, setAddRequest] = useState(null)

  const {
    items: customTabs,
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
  const isDmRole = !playerId || memberships.some((m) => m.role === 'dm')
  // A DM who also plays can switch to the player's view of the campaign
  // (remembered per campaign); `isDm` is whichever role they're acting in.
  const canSwitchView = Boolean(playerId) && isDmRole
  const [viewAs, setViewAsState] = useState(() => getStored(viewAsKey(campaignId), 'dm'))
  const isDm = isDmRole && !(canSwitchView && viewAs === 'player')
  // The campaign's creator and its DMs (and the admin) arrange shared
  // things, like the order of a map's pins.
  const canArrange = isDmRole || memberships.some((m) => m.role === 'creator' || m.createdBy === playerId)
  const dmView = Boolean(playerId) && isDm
  // Hold the screen until the role is known, so a DM doesn't see the
  // player layout flash first.
  const roleReady = !playerId || !roleLoading
  const areas = dmView ? DM_AREAS : AREAS.filter((area) => !area.dmOnly || isDm)
  const homeTab = dmView ? 'dm-overview' : 'home'

  const areaTabs = (area) => [
    ...area.tabs.map((id) => ({ id, ...TAB_DEFS[id] })),
    ...(area.custom ? customTabItems : []),
  ]
  const allTabs = areas.flatMap(areaTabs)

  const pathFor = useCallback((tab, entity = null) => campaignPath(slug, { admin, tab, entity }), [slug, admin])
  const setActiveTab = useCallback(
    (tab) => {
      setStored(lastTabKey(campaignId), tab)
      navigate(pathFor(tab))
      window.scrollTo({ top: 0 })
    },
    [campaignId, pathFor],
  )

  function switchView(next) {
    if (next === (isDm ? 'dm' : 'player')) return
    setViewAsState(next)
    setStored(viewAsKey(campaignId), next)
    setActiveTab(next === 'dm' ? 'dm-overview' : 'home')
  }

  // Falls back to Home if the remembered tab no longer exists (e.g. a
  // custom tab someone deleted) or isn't this player's to see. While the
  // role is still loading, a remembered DM tab is held rather than lost.
  const knownTab =
    allTabs.some((t) => t.id === activeTab) || (roleLoading && TAB_DEFS[activeTab]) ? activeTab : homeTab
  const activeArea =
    areas.find((area) => areaTabs(area).some((t) => t.id === knownTab)) || areas[0]

  // Keep the address on the screen actually shown: fill it in when it has
  // none, and correct it when it names one that isn't there (once the
  // role is known, so a DM's link isn't lost while it loads).
  useEffect(() => {
    if (roleReady && route.tab !== knownTab) navigate(pathFor(knownTab), { replace: true })
  }, [roleReady, route.tab, knownTab, pathFor])
  const closeEntry = useCallback((options) => navigate(pathFor(knownTab), options), [pathFor, knownTab])
  useEffect(() => {
    if (roleReady && route.tab === knownTab) setStored(lastTabKey(campaignId), knownTab)
  }, [roleReady, route.tab, knownTab, campaignId])

  // Who's here and which page each is on, for the header faces and the
  // "here too" strip over the page.
  const myAvatar = usePlayerAvatar(playerId)
  const people = usePartyPresence(
    campaignId,
    playerId,
    username,
    myAvatar,
    knownTab,
    allTabs.find((t) => t.id === knownTab)?.label || '',
  )

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
      setSearchOpen(false)
      setActiveTab(tab)
      if (options.add) setAddRequest({ tab, at: Date.now() })
    },
    // An entry opens over the current screen, with its own address, so the
    // back button (or a shared link) gets back to it.
    // (From the wiki, whose addresses name articles, it opens over the
    // entry's own screen — or this view's home if that isn't one of yours.)
    openEntity: (type, id) => {
      const own = ENTITY_TYPES[type]?.tab
      const tab = knownTab !== 'wiki' ? knownTab : allTabs.some((t) => t.id === own) ? own : homeTab
      navigate(pathFor(tab, { type, id }), { state: { fromEntry: Boolean(route.entity) && knownTab !== 'wiki' } })
    },
    openSearch: () => setSearchOpen(true),
    openQuickCreate: (type = 'npc', initial = {}) => setQuickCreate({ type, initial }),
    tabs: allTabs,
    isDm,
    canArrange,
  }
  const addRequestFor = (tab) => (addRequest?.tab === tab ? addRequest.at : null)

  return (
    <CampaignDataProvider campaignId={campaignId} playerId={playerId}>
      <CampaignNavContext.Provider value={nav}>
        <div className="campaign-view">
          {/* Back to the campaign list, in the page's top-left corner (phones
              have theirs in the top bar instead). */}
          <button type="button" className="btn btn--text campaign-view__back" onClick={onBack}>
            &larr; <span className="campaign-view__back-all">All </span>Campaigns
          </button>
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
              {canSwitchView && roleReady && (
                <div className="view-switch" role="group" aria-label="View the campaign as">
                  {[
                    { id: 'dm', label: 'DM', icon: 'eye' },
                    { id: 'player', label: 'Player', icon: 'user' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`view-switch__option${(isDm ? 'dm' : 'player') === v.id ? ' is-on' : ''}`}
                      aria-pressed={(isDm ? 'dm' : 'player') === v.id}
                      title={v.id === 'dm' ? 'DM view: your private notes and DM tools' : 'Player view: the campaign as your character'}
                      onClick={() => switchView(v.id)}
                    >
                      <Icon name={v.icon} />
                      <span className="view-switch__label">{v.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {roleReady && <CombatBadge target={dmView ? 'dm-combat' : 'session'} />}
              <SyncStatus />
              <PartyPresence people={people} />

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

          {route.entity && knownTab !== 'wiki' && <RoutedEntry entity={route.entity} onClose={closeEntry} />}

          {quickCreate && (
            <QuickCreateModal
              initialType={quickCreate.type}
              initial={quickCreate.initial}
              onClose={() => setQuickCreate(null)}
            />
          )}

          {/* Home and Session Mode have their own quick add and session controls. */}
          {!dmView && <SessionDock hidden={knownTab === 'home' || knownTab === 'session'} />}
          {/* While a session is being recorded (any tab). */}
          <RecordingBar />
          {roleReady && <TurnAlert />}
          {/* A new party vote pops up wherever you are (Session Mode shows it in place). */}
          {playerId && roleReady && <PollPopup onSessionTab={knownTab === (isDm ? 'tools' : 'session')} />}
          {/* Combat theme for everyone; the shake-and-roll alert is for players. */}
          {roleReady && <CombatMode showAlert={Boolean(playerId) && !isDm} />}
          {/* Players see the DM's live reveals; the DM is the one sending them. */}
          {playerId && roleReady && !isDm && <RevealOverlay campaignId={campaignId} />}
          {playerId && roleReady && !isDm && <ShardAlert campaignId={campaignId} playerId={playerId} />}
          {/* A heartbeat at the screen edges while your character is dying. */}
          {playerId && roleReady && !isDm && <DownedPulse />}
          {/* Celebrates a party member's level going up, for everyone. */}
          {roleReady && <LevelUp />}

          <div
            className={`campaign-view__body${sidebarOpen ? '' : ' campaign-view__body--sidebar-collapsed'}`}
          >
            {sidebarOpen && (
              <aside className="campaign-view__sidebar" aria-label="Campaign navigation">
                <div className="campaign-view__title-block">
                  <h2 className="campaign-view__name">{campaignName}</h2>
                </div>

                {roleReady && areas.map((area) => {
                  const foldable = area.tabs.length > 1
                  const folded = foldable && foldedGroups.includes(area.id)
                  const holdsActive = areaTabs(area).some((t) => t.id === knownTab)
                  return (
                    <div className={`campaign-view__group${folded ? ' is-folded' : ''}`} key={area.id}>
                      {foldable && (
                        <h3 className="campaign-view__group-label">
                          <button
                            type="button"
                            className="campaign-view__group-toggle"
                            aria-expanded={!folded}
                            aria-controls={`sidebar-group-${area.id}`}
                            onClick={() => toggleGroup(area.id)}
                          >
                            <Icon name="next" className="campaign-view__group-chevron" />
                            {area.label}
                            {folded && holdsActive && <span className="campaign-view__group-dot" aria-label="(current page)" />}
                          </button>
                        </h3>
                      )}
                      <div className="campaign-view__group-body" id={`sidebar-group-${area.id}`} inert={folded || undefined}>
                        <div className="campaign-view__group-inner">
                          <TabNav
                            tabs={areaTabs(area)}
                            activeTab={knownTab}
                            onSelect={setActiveTab}
                            className="tab-nav--sidebar"
                            label={`${area.label} sections`}
                            vertical
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </aside>
            )}

            <div className="campaign-view__content">
              {knownTab !== 'home' && <h2 className="campaign-view__mobile-title">{campaignName}</h2>}
              {areaTabs(activeArea).length > 1 && (
                <TabNav
                  tabs={areaTabs(activeArea)}
                  activeTab={knownTab}
                  onSelect={setActiveTab}
                  className="tab-nav--pill campaign-view__subnav"
                  label={`${activeArea.label} sections`}
                />
              )}

              {!roleReady && <p className="empty-state">Loading…</p>}
              {roleReady && <HereToo people={people} tab={knownTab} />}
              {/* Keyed per screen so each tab starts fresh. */}
              {roleReady && (
              <div key={knownTab} className="campaign-view__screen">
              {knownTab === 'home' && <HomeHub campaignName={campaignName} />}
              {knownTab === 'wiki' && (
                <WikiTab
                  pathFor={(entity) => pathFor('wiki', entity)}
                  ownTabHref={campaignPath(slug, { admin, world: true })}
                />
              )}
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
              {knownTab === 'web' && <RelationshipWeb />}
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
              {isDm && knownTab === 'dm-overview' && <DmOverview />}
              {isDm && knownTab === 'dm-players' && <DmPlayersTab campaignName={campaignName} />}
              {isDm && knownTab === 'dm-combat' && (
                <div className="campaign-view__combat">
                  <InitiativeTracker />
                  <PartyLevelUp />
                </div>
              )}
              {knownTab === 'tools' && <ToolsTab campaignId={campaignId} playerId={playerId} isDm={isDm} />}
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
