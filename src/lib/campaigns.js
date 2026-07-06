import { supabase } from './supabaseClient.js'

export async function createCampaign(playerId, { name, description, coverImagePath }) {
  const { data, error } = await supabase.rpc('create_campaign', {
    p_player_id: playerId,
    p_name: name,
    p_description: description,
    p_cover_image_path: coverImagePath,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return { id: row.id, joinCode: row.join_code }
}

export async function joinCampaign(playerId, joinCode) {
  const { data, error } = await supabase.rpc('join_campaign', {
    p_player_id: playerId,
    p_join_code: joinCode,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listCampaignMembers(campaignId) {
  const { data, error } = await supabase.rpc('list_campaign_members', {
    p_campaign_id: campaignId,
  })
  if (error) throw new Error(error.message)
  return data.map((r) => ({
    membershipId: r.membership_id,
    playerId: r.player_id,
    username: r.username,
    role: r.role,
  }))
}

// Every membership across every campaign — used by the admin panel to
// show which campaigns each player participates in. campaign_memberships
// carries no secrets (see supabase/schema.sql), so this is a plain anon
// select, no RPC/admin-password gate needed.
export async function listAllMemberships() {
  const { data, error } = await supabase.from('campaign_memberships').select('*')
  if (error) throw new Error(error.message)
  return data.map((r) => ({
    playerId: r.player_id,
    role: r.role,
    campaignId: r.id,
    campaignName: r.name,
    joinCode: r.join_code,
  }))
}
