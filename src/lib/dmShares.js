import { supabase } from './supabaseClient.js'
import { notifyTableChanged } from '../hooks/useSupabaseTable.js'
import { copyImage, getPublicUrl } from './storage.js'
import { getPlayerSession } from './auth.js'
import { tagToken } from './noteTags.js'

// What the DM can share, and where each lands for the players.
export const SHARE_KINDS = {
  npc: { label: 'NPC', icon: 'user', tab: 'npcs', tabLabel: 'NPCs', bucket: 'npc-portraits' },
  art: { label: 'Art', icon: 'image', tab: 'art', tabLabel: 'Art', bucket: 'campaign-art' },
  map: { label: 'Map', icon: 'map', tab: 'maps', tabLabel: 'Maps', bucket: 'maps' },
  creature: { label: 'Creature', icon: 'creature', tab: 'creatures', tabLabel: 'Creatures', bucket: 'creature-photos' },
}

// The kind's label ("NPC", "Creature"…).
export function shareLabel(share) {
  return SHARE_KINDS[share.kind].label
}

export const shareKey = (kind, sourceId) => `${kind}:${sourceId}`

// Postgres error codes PostgREST passes through.
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

// Posts a notification for every player. `payload` is a snapshot of only
// the player-safe fields — never the DM's secret notes. `reveal` also pops
// it up full-screen on every player's device that's open right now.
export async function shareWithPlayers({ campaignId, kind, sourceId, title, payload, reveal = false }) {
  const body = reveal ? { ...payload, reveal: true } : payload
  const { error } = await supabase
    .from('dm_shares')
    .insert({ campaign_id: campaignId, kind, source_id: sourceId, title, payload: body })
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

// The id of the party's copy of a shared item, if there is one.
async function existingId(table, column, value) {
  const { data, error } = await supabase.from(table).select('id').eq(column, value).limit(1)
  if (error) throw new Error(error.message)
  return data[0]?.id || null
}

// The line written into the player's quick notes when they take a share
// in, with the matching tag — @ for an NPC, # for a map (Maps & Places),
// % for a creature, ! for a piece of art (an event on the
// Timeline) — so it
// lands in their recap at End Session like a tag they'd typed.
export function shareNote(share, partyId) {
  const p = share.payload || {}
  const name = (share.kind === 'map' ? p.caption : p.name) || share.title || 'something'
  switch (share.kind) {
    case 'npc':
      return `Met ${tagToken({ char: '@', id: partyId, label: name })} — shared by the DM.`
    case 'map':
      return `Got a map: ${tagToken({ char: '#', id: partyId, label: name })} — shared by the DM.`
    case 'creature':
      return `Encountered ${tagToken({ char: '%', id: partyId, label: name })} — shared by the DM.`
    case 'art':
      return `${tagToken({ char: '!', id: `share-${share.id}`, label: `Saw ${share.title || 'a scene'}` })} — shared by the DM.`
    default:
      return null
  }
}

async function noteForPlayer(share, campaignId, partyId) {
  const playerId = getPlayerSession()?.playerId
  const content = shareNote(share, partyId)
  if (!playerId || !content) return
  // A note is a bonus: if it can't be written the item is still added.
  const { error } = await supabase.from('quick_notes').insert({ campaign_id: campaignId, player_id: playerId, content })
  if (!error) notifyTableChanged('quick_notes')
}

// A player's "Add" on a notification. Resolves to 'added', 'already'
// (someone got there first — nothing is duplicated) or 'gone' (the DM
// deleted it since sharing). Either way the player who took it in gets
// a tagged line in their quick notes (see shareNote).
export async function addShareToParty(share, campaignId) {
  const outcome = await addToPartyTables(share, campaignId)
  if (outcome.result !== 'gone') await noteForPlayer(share, campaignId, outcome.id)
  return outcome.result
}

async function addToPartyTables(share, campaignId) {
  const { kind, sourceId, payload } = share
  if (kind === 'art') {
    const { data, error } = await supabase.from('campaign_art').select('id, shared').eq('id', sourceId)
    if (error) throw new Error(error.message)
    if (!data.length) return { result: 'gone' }
    if (data[0].shared) return { result: 'already', id: sourceId }
    const { error: updateError } = await supabase.from('campaign_art').update({ shared: true }).eq('id', sourceId)
    if (updateError) throw new Error(updateError.message)
    notifyTableChanged('campaign_art')
    return { result: 'added', id: sourceId }
  }

  if (kind === 'creature') {
    const had = await existingId('creatures', 'dm_creature_id', sourceId)
    if (had) return { result: 'already', id: had }
    // The party gets its own copies of the photos, so the DM deleting
    // theirs doesn't take the party's with it.
    const photos = []
    for (const path of Array.isArray(payload.photos) ? payload.photos : []) {
      const copy = await copyOrReuse(SHARE_KINDS.creature.bucket, path)
      if (copy) photos.push(copy)
    }
    const { data: made, error } = await supabase.from('creatures').insert({
      campaign_id: campaignId,
      name: payload.name || share.title || 'Unnamed',
      kind: 'Creature',
      creature_type: payload.creature_type || '',
      notes: payload.description || '',
      photos,
      dm_creature_id: sourceId,
    }).select('id').single()
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { result: 'already', id: await existingId('creatures', 'dm_creature_id', sourceId) }
      if (error.code === FOREIGN_KEY_VIOLATION) return { result: 'gone' }
      throw new Error(error.message)
    }
    notifyTableChanged('creatures')
    return { result: 'added', id: made.id }
  }

  const isNpc = kind === 'npc'
  const table = isNpc ? 'npcs' : 'maps'
  const linkColumn = isNpc ? 'dm_npc_id' : 'dm_map_id'
  const had = await existingId(table, linkColumn, sourceId)
  if (had) return { result: 'already', id: had }

  const bucket = SHARE_KINDS[kind].bucket
  const imagePath = await copyOrReuse(bucket, isNpc ? payload.photo_path : payload.image_path)
  if (!isNpc && !imagePath) return { result: 'gone' }
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

  const { data: made, error } = await supabase.from(table).insert(row).select('id').single()
  if (error) {
    if (imagePath && imagePath !== (isNpc ? payload.photo_path : payload.image_path)) {
      supabase.storage.from(bucket).remove([imagePath])
    }
    if (error.code === UNIQUE_VIOLATION) return { result: 'already', id: await existingId(table, linkColumn, sourceId) }
    if (error.code === FOREIGN_KEY_VIOLATION) return { result: 'gone' }
    throw new Error(error.message)
  }
  notifyTableChanged(table)
  return { result: 'added', id: made.id }
}

// The picture that goes with a share (portrait, art, map or a creature's
// first photo), if any.
export function shareImage(share) {
  const { bucket } = SHARE_KINDS[share.kind]
  if (!bucket) return ''
  const p = share.payload
  const path = share.kind === 'npc' ? p.photo_path : share.kind === 'creature' ? p.photos?.[0] : p.image_path
  return getPublicUrl(bucket, path)
}

// One line of detail under a share's title.
export function shareDetail(share) {
  const p = share.payload
  if (share.kind === 'npc') return [p.race, p.location].filter(Boolean).join(' · ')
  if (share.kind === 'art') return p.category || ''
  if (share.kind === 'creature') return p.creature_type || ''
  return ''
}
