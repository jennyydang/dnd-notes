import { useEffect, useMemo, useState } from 'react'
import AdminGate from './components/AdminGate.jsx'
import PlayerLogin from './components/PlayerLogin.jsx'
import PlayerDashboard from './components/PlayerDashboard.jsx'
import CampaignView from './components/CampaignView.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import Ambience from './components/Ambience.jsx'
import { PLAYER_SESSION_CHANGED, clearPlayerSession, getAdminSession, getPlayerSession, resetFromUrl } from './lib/auth.js'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import { clearCache } from './lib/offline.js'
import { applySettings, getSettings } from './lib/settings.js'
import { installTapFeedback } from './lib/tapFeedback.js'
import { installKeyboardAvoidance } from './lib/keyboard.js'
import { installSwipeActions } from './lib/swipeActions.js'
import { installPullToRefresh } from './lib/pullToRefresh.js'
import { installSelectMenus } from './lib/selectMenu.js'
import { AI_CONNECTION_EVENT, saveAiConnection } from './lib/aiConnection.js'
import { finishChatGptSignIn, rememberChatGptSignInError } from './lib/chatgptSignIn.js'
import { getStored, setStored } from './lib/sessionMode.js'
import { navigate, usePath } from './lib/router.js'
import { campaignPath, campaignSlug, findCampaign, parseRoute } from './lib/routes.js'
import { useSupabaseTable } from './hooks/useSupabaseTable.js'
import WikiPage from './components/WikiPage.jsx'
import './App.scss'

const isAdminPath =
  typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))

// Remembers which campaign was last open (per browser), so opening the app
// at "/" (say, from the home-screen icon) lands back in it mid-session.
const OPEN_CAMPAIGN_KEY = `dnd-notes-open-campaign${isAdminPath ? ':admin' : ''}`

function App() {
  const [playerSession, setPlayerSession] = useState(() => getPlayerSession())
  // A password reset link (…/?reset=TOKEN) shows its page first, even on
  // a device where someone is logged in.
  const [resetToken, setResetToken] = useState(() => (isAdminPath ? '' : resetFromUrl()))
  const path = usePath()
  const route = parseRoute(path)
  const base = isAdminPath ? '/admin' : '/'
  const loggedIn = Boolean(isAdminPath ? getAdminSession() : playerSession)

  // Your campaigns, to read the campaign out of an address (/c/anadoss):
  // a player's memberships, or every campaign for the admin.
  const playerId = playerSession?.playerId
  const mine = useSupabaseTable('campaign_memberships', {
    fromRow: (r) => ({ id: r.id, name: r.name }),
    filters: { player_id: !isAdminPath && playerId ? playerId : [] },
  })
  const all = useSupabaseTable('campaigns', {
    fromRow: (r) => ({ id: r.id, name: r.name }),
    filters: isAdminPath ? {} : { id: [] },
  })
  const campaigns = isAdminPath ? all.items : mine.items
  const campaignsLoading = isAdminPath ? all.loading : mine.loading

  // The open campaign comes from the address. While your list loads, the
  // one you had open last stands in if it matches.
  const remembered = loggedIn ? getStored(OPEN_CAMPAIGN_KEY, null) : null
  const selectedCampaign = useMemo(() => {
    if (!route.campaign) return null
    const found = findCampaign(route.campaign, campaigns)
    if (found) return found
    if (remembered && findCampaign(route.campaign, [remembered])) return remembered
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.campaign, campaigns, remembered?.id])
  useEffect(() => {
    if (selectedCampaign) setStored(OPEN_CAMPAIGN_KEY, { id: selectedCampaign.id, name: selectedCampaign.name })
  }, [selectedCampaign])

  // Opening the app at "/" with a campaign still open from last time goes
  // straight back into it (unless a reset or invite link is in the address).
  useEffect(() => {
    if (!route.campaign && remembered && !window.location.search && path === (isAdminPath ? '/admin' : '/')) {
      navigate(campaignPath(campaignSlug(remembered, campaigns), { admin: isAdminPath }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setSelectedCampaign(campaign) {
    if (!campaign) {
      setStored(OPEN_CAMPAIGN_KEY, null)
      navigate(base)
      return
    }
    setStored(OPEN_CAMPAIGN_KEY, { id: campaign.id, name: campaign.name })
    // (A campaign just joined or created may not be in the list yet.)
    const known = [...campaigns.filter((c) => c.id !== campaign.id), campaign]
    navigate(campaignPath(campaignSlug(campaign, known), { admin: isAdminPath }))
  }

  // Apply a returning visitor's saved background/font/text-size preset
  // once on startup — no prop drilling needed since it's just data-*
  // attributes on <html> (see src/styles/_base.scss).
  useEffect(() => {
    applySettings(getSettings())
  }, [])

  useEffect(() => installTapFeedback(), [])
  useEffect(() => installKeyboardAvoidance(), [])
  useEffect(() => installSwipeActions(), [])
  useEffect(() => installPullToRefresh(), [])
  useEffect(() => installSelectMenus(), [])
  // Back from "Sign in with ChatGPT": finish it and keep the connection.
  useEffect(() => {
    finishChatGptSignIn()
      .then((connection) => connection && saveAiConnection(connection))
      .catch((err) => {
        // Keep any connection the player already had; just say why.
        rememberChatGptSignInError(err.message)
        window.dispatchEvent(new Event(AI_CONNECTION_EVENT))
      })
  }, [])

  // Picks up a changed session (e.g. a new username from Account).
  useEffect(() => {
    const sync = () => setPlayerSession(getPlayerSession())
    window.addEventListener(PLAYER_SESSION_CHANGED, sync)
    return () => window.removeEventListener(PLAYER_SESSION_CHANGED, sync)
  }, [])

  function logOut() {
    // Cached rows are this player's; queued writes stay and still sync.
    clearCache()
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
  } else if (resetToken) {
    content = <ResetPassword token={resetToken} onDone={() => setResetToken('')} />
  } else if (route.campaign && loggedIn && !selectedCampaign) {
    // An address for a campaign you're not in (or that's gone).
    content = campaignsLoading ? (
      <p className="empty-state">Loading…</p>
    ) : (
      <div className="setup-notice panel">
        <h2>Campaign not found</h2>
        <p>This link is for a campaign you’re not in, or one that no longer exists.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate(base)}>
          Go to your campaigns
        </button>
      </div>
    )
  } else if (selectedCampaign && route.world) {
    content = (
      <WikiPage
        campaignId={selectedCampaign.id}
        campaignName={selectedCampaign.name}
        slug={route.campaign}
        admin={isAdminPath}
        playerId={playerSession?.playerId}
      />
    )
  } else if (selectedCampaign) {
    content = (
      <CampaignView
        key={selectedCampaign.id}
        campaignId={selectedCampaign.id}
        campaignName={selectedCampaign.name}
        slug={route.campaign}
        admin={isAdminPath}
        playerId={playerSession?.playerId}
        username={playerSession?.username}
        onBack={() => setSelectedCampaign(null)}
        onLogOut={logOut}
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

  // The stand-alone wiki is the whole page: no app header.
  if (selectedCampaign && route.world && !resetToken) {
    return (
      <>
        <Ambience />
        <div className="app app--bare">{content}</div>
      </>
    )
  }

  return (
    <>
      <Ambience />
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Adventurer&rsquo;s Log</h1>
          <p className="app__subtitle">Dungeons &amp; Dragons campaign notes</p>
        </header>
        <main>{content}</main>
      </div>
    </>
  )
}

export default App
