// Addresses inside the app:
//   /                                  your campaigns
//   /c/anadoss                         a campaign (its last-used screen)
//   /c/anadoss/quests                  a screen
//   /c/anadoss/quests/quest/1a2b3c4d   …with an entry open
//   /c/anadoss/wiki/npc/1a2b3c4d       a World Wiki article
//   /c/anadoss/world[/npc/1a2b3c4d]    the World Wiki on its own page
// The admin's live under /admin. A campaign's part is its name, plus the
// start of its id when you're in two campaigns with the same name.

export const slugify = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campaign'

const shortId = (id) => String(id).slice(0, 8)

// The address part for `campaign`, unique among `all` (your campaigns).
export function campaignSlug(campaign, all = []) {
  const base = slugify(campaign.name)
  const clash = all.some((c) => c.id !== campaign.id && slugify(c.name) === base)
  return clash ? `${base}-${shortId(campaign.id)}` : base
}

// Which of `all` an address part means: "name-1a2b3c4d" exactly, or
// "name" (the first such, if several share it).
export function findCampaign(slug, all = []) {
  if (!slug) return null
  return (
    all.find((c) => `${slugify(c.name)}-${shortId(c.id)}` === slug) ||
    all.find((c) => slugify(c.name) === slug) ||
    null
  )
}

// Screens whose address differs from their id.
const SEGMENT_FOR = { sessions: 'notes', web: 'connections' }
const TAB_FOR = Object.fromEntries(Object.entries(SEGMENT_FOR).map(([tab, seg]) => [seg, tab]))

export const tabSegment = (tab) =>
  tab.startsWith('custom:') ? `tab-${tab.slice('custom:'.length)}` : SEGMENT_FOR[tab] || tab
export const segmentTab = (seg) => (seg.startsWith('tab-') ? `custom:${seg.slice(4)}` : TAB_FOR[seg] || seg)

export const entityRef = (id) => shortId(id)

export function parseRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const admin = parts[0] === 'admin'
  if (admin) parts.shift()
  const route = { admin, campaign: null, tab: null, entity: null, world: false }
  if (parts[0] !== 'c' || !parts[1]) return route
  route.campaign = parts[1]
  if (parts[2] === 'world') {
    route.world = true
    if (parts[3] && parts[4]) route.entity = { type: parts[3], ref: parts[4] }
    return route
  }
  if (parts[2]) route.tab = segmentTab(parts[2])
  if (parts[3] && parts[4]) route.entity = { type: parts[3], ref: parts[4] }
  return route
}

export function campaignPath(slug, { admin = false, tab = null, entity = null, world = false } = {}) {
  let path = `${admin ? '/admin' : ''}/c/${encodeURIComponent(slug)}`
  if (world) path += '/world'
  else if (tab) path += `/${tabSegment(tab)}`
  if (entity && (tab || world)) path += `/${entity.type}/${entityRef(entity.id)}`
  return path
}
