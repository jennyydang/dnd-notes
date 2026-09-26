import { createContext, useContext } from 'react'

export const CampaignDataContext = createContext(null)

// Campaign-wide index of every entry and link — provided by
// CampaignDataProvider (components/CampaignDataProvider.jsx).
export function useCampaignData() {
  const value = useContext(CampaignDataContext)
  if (!value) throw new Error('useCampaignData must be used inside CampaignDataProvider')
  return value
}

// Navigation actions CampaignView exposes to everything inside it: switch
// tab, open an entry's detail view, open search, or quick-create an entry.
export const CampaignNavContext = createContext({
  goTo: () => {},
  openEntity: () => {},
  openSearch: () => {},
  openQuickCreate: () => {},
  tabs: [],
})

export const useCampaignNav = () => useContext(CampaignNavContext)
