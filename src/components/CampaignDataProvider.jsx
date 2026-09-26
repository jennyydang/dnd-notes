import { useCallback, useMemo } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { CampaignDataContext } from '../hooks/useCampaignData.js'
import { ENTITY_TYPES, entityKey, normalizeEntity } from '../lib/entities.js'

const identity = (row) => row

// Loads every searchable/linkable table for the open campaign once, at the
// CampaignView level, and shares it with Home, Session Mode, Prep, search
// and the entry detail view. Tabs keep their own hooks for editing; every
// write made through useSupabaseTable broadcasts a change, so this index
// quietly refetches and stays current.
function CampaignDataProvider({ campaignId, playerId, children }) {
  const shared = { campaign_id: campaignId }
  const personal = playerId ? { campaign_id: campaignId, player_id: playerId } : shared
  const opts = (type) => ({
    fromRow: identity,
    filters: ENTITY_TYPES[type].scope === 'player' ? personal : shared,
  })

  const tables = {
    npc: useSupabaseTable('npcs', opts('npc')),
    place: useSupabaseTable('places', opts('place')),
    quest: useSupabaseTable('quests', opts('quest')),
    lore: useSupabaseTable('lore_entries', opts('lore')),
    loot: useSupabaseTable('loot', opts('loot')),
    session: useSupabaseTable('session_notes', opts('session')),
    note: useSupabaseTable('quick_notes', opts('note')),
    character: useSupabaseTable('party_members', opts('character')),
    goal: useSupabaseTable('party_goals', opts('goal')),
  }
  const links = useSupabaseTable('entity_links', { fromRow: identity, filters: shared })

  const loading = Object.values(tables).some((t) => t.loading) || links.loading
  // A table missing from an older database (e.g. quick_notes before the
  // new SQL was run) shouldn't take the whole index down — report it and
  // carry on with what did load.
  const errors = Object.entries(tables)
    .filter(([, t]) => t.error)
    .map(([type, t]) => `${ENTITY_TYPES[type].plural}: ${t.error}`)
  if (links.error) errors.push(`Links: ${links.error}`)

  const rowsKey = Object.values(tables).map((t) => t.items)
  const entities = useMemo(
    () =>
      Object.entries(tables).flatMap(([type, t]) => t.items.map((row) => normalizeEntity(type, row))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    rowsKey,
  )
  const byKey = useMemo(
    () => new Map(entities.map((e) => [entityKey(e.type, e.id), e])),
    [entities],
  )

  const addLink = links.addItem
  const removeLink = links.removeItem
  const linkEntities = useCallback(
    (source, target, relation = '', notes = '') =>
      addLink({
        source_type: source.type,
        source_id: source.id,
        target_type: target.type,
        target_id: target.id,
        relation,
        notes,
      }),
    [addLink],
  )

  const value = {
    campaignId,
    playerId,
    tables,
    entities,
    byKey,
    getEntity: (type, id) => byKey.get(entityKey(type, id)) || null,
    links: links.items,
    linkEntities,
    removeLink,
    loading,
    errors,
  }

  return <CampaignDataContext.Provider value={value}>{children}</CampaignDataContext.Provider>
}

export default CampaignDataProvider
