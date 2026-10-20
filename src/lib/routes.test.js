import { describe, expect, it } from 'vitest'
import { campaignPath, campaignSlug, findCampaign, parseRoute, slugify, segmentTab, tabSegment } from './routes.js'

const anadoss = { id: '1a2b3c4d-0000-0000-0000-000000000000', name: 'Anadoss' }
const halloween = { id: '9f8e7d6c-0000-0000-0000-000000000000', name: 'Halloween One Shot #2' }
const anadoss2 = { id: '55555555-0000-0000-0000-000000000000', name: 'ANADOSS' }

describe('routes', () => {
  it('turns campaign names into readable addresses', () => {
    expect(slugify('Halloween One Shot #2')).toBe('halloween-one-shot-2')
    expect(slugify('Ferelia’s Brothel')).toBe('ferelias-brothel')
    expect(slugify('Élan')).toBe('elan')
    expect(slugify('!!!')).toBe('campaign')
  })

  it('adds the start of the id only when two of your campaigns share a name', () => {
    expect(campaignSlug(anadoss, [anadoss, halloween])).toBe('anadoss')
    expect(campaignSlug(anadoss, [anadoss, anadoss2])).toBe('anadoss-1a2b3c4d')
    expect(findCampaign('anadoss-55555555', [anadoss, anadoss2])).toBe(anadoss2)
    expect(findCampaign('anadoss', [anadoss, halloween])).toBe(anadoss)
    expect(findCampaign('nope', [anadoss])).toBeNull()
  })

  it('reads and writes screen and entry addresses', () => {
    expect(parseRoute('/')).toMatchObject({ campaign: null, admin: false })
    expect(parseRoute('/c/anadoss')).toMatchObject({ campaign: 'anadoss', tab: null })
    expect(parseRoute('/c/anadoss/notes')).toMatchObject({ tab: 'sessions' })
    expect(parseRoute('/c/anadoss/quests/quest/1a2b3c4d')).toMatchObject({ tab: 'quests', entity: { type: 'quest', ref: '1a2b3c4d' } })
    expect(parseRoute('/c/anadoss/world/npc/abcd1234')).toMatchObject({ world: true, entity: { type: 'npc', ref: 'abcd1234' } })
    expect(parseRoute('/admin/c/anadoss/dm-npcs')).toMatchObject({ admin: true, tab: 'dm-npcs' })
    expect(campaignPath('anadoss', { tab: 'web' })).toBe('/c/anadoss/connections')
    expect(campaignPath('anadoss', { tab: 'npcs', entity: { type: 'npc', id: 'abcd1234-ffff' } })).toBe('/c/anadoss/npcs/npc/abcd1234')
    expect(campaignPath('anadoss', { world: true })).toBe('/c/anadoss/world')
    expect(campaignPath('anadoss', { admin: true, tab: 'home' })).toBe('/admin/c/anadoss/home')
  })

  it('round-trips custom tabs', () => {
    expect(tabSegment('custom:abc')).toBe('tab-abc')
    expect(segmentTab('tab-abc')).toBe('custom:abc')
  })
})
