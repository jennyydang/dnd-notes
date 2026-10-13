import { supabase } from './supabaseClient.js'
import { notifyTableChanged } from '../hooks/useSupabaseTable.js'
import { copyImage } from './storage.js'

// What the DM can share, and where each lands for the players.
export const SHARE_KINDS = {
  npc: { label: 'NPC', icon: '👤', tab: 'npcs', tabLabel: 'NPCs', bucket: 'npc-portraits' },
  art: { label: 'Art', icon: '🖼️', tab: 'art', tabLabel: 'Art', bucket: 'campaign-art' },
  map: { label: 'Map', icon: '🗺️', tab: 'maps', tabLabel: 'Maps', bucket: 'maps' },
  creature: { label: 'Monster', icon: '🐉', tab: 'creatures', tabLabel: 'Monsters & Creatures', bucket: null },
}

// "Monster" or "Creature" for a creature share; the kind's label otherwise.
export function shareLabel(share) {
  if (share.kind === 'creature') return share.payload.kind === 'Creature' ? 'Creature' : 'Monster'
  return SHARE_KINDS[share.kind].label
}

export const shareKey = (kind, sourceId) => `${kind}:${sourceId}`

// Postgres error codes PostgREST passes through.
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

// Posts a notification for every player. `payload` is a snapshot of only
// the player-safe fields — never the DM's secret notes.
export async function shareWithPlayers({ campaignId, kind, sourceId, title, payload }) {
  const { error } = await supabase
    .from('dm_shares')
    .insert({ campaign_id: campaignId, kind, source_id: sourceId, title, payload })
  if (error) throw new Error(error.message)
  notifyTableChanged('dm_shares')
}

// When the DM deletes an item, its notifications go too.
export async function removeSharesFor(sourceId) {
  const { error } = await supabase.from('dm_shares').delete().eq('source_id', sourceId)
  if (!error) notifyTableChanged('dm_shares')
}

async function copyOrReuse(bucket, path) {
  if (!path) return null
  try {
    return await copyImage(bucket, path)
  } catch {
    return path
  }
}

async function exists(table, column, value) {
  const { data, error } = await supabase.from(table).select('id').eq(column, value).limit(1)
  if (error) throw new Error(error.message)
  return data.length > 0
}

// A player's "Add" on a notification. Resolves to 'added', 'already'
// (someone got there first — nothing is duplicated) or 'gone' (the DM
// deleted it since sharing).
export async function addShareToParty(share, campaignId) {
  const { kind, sourceId, payload } = share
  if (kind === 'art') {
    const { data, error } = await supabase.from('campaign_art').select('id, shared').eq('id', sourceId)
    if (error) throw new Error(error.message)
    if (!data.length) return 'gone'
    if (data[0].shared) return 'already'
    const { error: updateError } = await supabase.from('campaign_art').update({ shared: true }).eq('id', sourceId)
    if (updateError) throw new Error(updateError.message)
    notifyTableChanged('campaign_art')
    return 'added'
  }

  if (kind === 'creature') {
    if (await exists('creatures', 'dm_creature_id', sourceId)) return 'already'
    const { error } = await supabase.from('creatures').insert({
      campaign_id: campaignId,
      name: payload.name || share.title || 'Unnamed',
      kind: payload.kind === 'Creature' ? 'Creature' : 'Monster',
      creature_type: payload.creature_type || '',
      challenge: payload.challenge || '',
      armor_class: payload.armor_class ?? null,
      hit_points: payload.hit_points ?? null,
      notes: payload.description || '',
      dm_creature_id: sourceId,
    })
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return 'already'
      if (error.code === FOREIGN_KEY_VIOLATION) return 'gone'
      throw new Error(error.message)
    }
    notifyTableChanged('creatures')
    return 'added'
  }

  const isNpc = kind === 'npc'
  const table = isNpc ? 'npcs' : 'maps'
  const linkColumn = isNpc ? 'dm_npc_id' : 'dm_map_id'
  if (await exists(table, linkColumn, sourceId)) return 'already'

  const bucket = SHARE_KINDS[kind].bucket
  const imagePath = await copyOrReuse(bucket, isNpc ? payload.photo_path : payload.image_path)
  if (!isNpc && !imagePath) return 'gone'
  const row = isNpc
    ? {
        campaign_id: campaignId,
        name: payload.name || share.title || 'Unnamed',
        race: payload.race || '',
        met_at: payload.location || '',
        status: 'Alive',
        description: payload.description || '',
        photo_path: imagePath,
        dm_npc_id: sourceId,
      }
    : { campaign_id: campaignId, image_path: imagePath, caption: payload.caption || share.title || '', dm_map_id: sourceId }

  const { error } = await supabase.from(table).insert(row)
  if (error) {
    if (imagePath && imagePath !== (isNpc ? payload.photo_path : payload.image_path)) {
      supabase.storage.from(bucket).remove([imagePath])
    }
    if (error.code === UNIQUE_VIOLATION) return 'already'
    if (error.code === FOREIGN_KEY_VIOLATION) return 'gone'
    throw new Error(error.message)
  }
  notifyTableChanged(table)
  return 'added'
}
