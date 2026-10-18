import { useEffect } from 'react'
import CampaignDataProvider from './CampaignDataProvider.jsx'
import { CampaignNavContext } from '../hooks/useCampaignData.js'
import { ENTITY_TYPES } from '../lib/entities.js'
import { navigate } from '../lib/router.js'
import { campaignPath } from '../lib/routes.js'
import WikiTab from './WikiTab.jsx'
import Icon from './Icon.jsx'
import './WikiPage.scss'

// The World Wiki on a page of its own (/c/anadoss/world): no sidebar, top
// bar or menus — just the wiki, to keep open beside the app or share.
// "Open entry" and "Back to the app" go into the full app.
function WikiPage({ campaignId, campaignName, slug, admin = false, playerId }) {
  const appPath = (tab, entity = null) => campaignPath(slug, { admin, tab, entity })

  useEffect(() => {
    const before = document.title
    document.title = `World Wiki — ${campaignName}`
    return () => {
      document.title = before
    }
  }, [campaignName])

  const nav = {
    goTo: (tab) => navigate(appPath(tab)),
    openEntity: (type, id) => navigate(appPath(ENTITY_TYPES[type]?.tab || 'home', { type, id })),
    openSearch: () => {},
    openQuickCreate: () => {},
    tabs: [],
    isDm: false,
    canArrange: false,
  }

  return (
    <CampaignDataProvider campaignId={campaignId} playerId={playerId}>
      <CampaignNavContext.Provider value={nav}>
        <div className="wiki-page">
          <header className="wiki-page__bar">
            <div>
              <p className="wiki-page__eyebrow">{campaignName}</p>
              <h1 className="wiki-page__title">World Wiki</h1>
            </div>
            <a className="btn btn--text wiki-page__back" href={appPath('wiki')} onClick={(e) => {
              e.preventDefault()
              navigate(appPath('wiki'))
            }}>
              <Icon name="prev" /> Back to the app
            </a>
          </header>
          <WikiTab pathFor={(entity) => campaignPath(slug, { admin, world: true, entity })} />
        </div>
      </CampaignNavContext.Provider>
    </CampaignDataProvider>
  )
}

export default WikiPage
