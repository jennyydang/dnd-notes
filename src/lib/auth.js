import { supabase } from './supabaseClient.ts'

const PLAYER_SESSION_KEY = 'dnd-notes-player-session'
const ADMIN_SESSION_KEY = 'dnd-notes-admin-session'

export function getPlayerSession() {
  try {
    const raw = localStorage.getItem(PLAYER_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Other parts of the app (App.jsx) listen for this to pick up a changed
// session, e.g. after a player renames themselves.
export const PLAYER_SESSION_CHANGED = 'player-session-changed'

export function setPlayerSession(session) {
  localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session))
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_SESSION_KEY)
}

// Stores the admin password itself (not just a flag) so the admin stays
// "logged in" across reloads without re-prompting — the admin-only RPCs
// below need the real password on every call. Same trust model as the
// rest of this app: the anon key is already fully exposed in the client
// bundle, so this isn't a new category of exposure, just a convenience.
export function getAdminSession() {
  return localStorage.getItem(ADMIN_SESSION_KEY)
}

export function setAdminSession(password) {
  localStorage.setItem(ADMIN_SESSION_KEY, password)
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export async function verifyAdminPassword(password) {
  const { data, error } = await supabase.rpc('verify_admin_password', {
    p_admin_password: password,
  })
  if (error) throw new Error(error.message)
  return data === true
}

export async function createPlayer(username, password, adminPassword) {
  const { data, error } = await supabase.rpc('create_player', {
    p_username: username,
    p_password: password,
    p_admin_password: adminPassword,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listPlayers(adminPassword) {
  const { data, error } = await supabase.rpc('list_players', {
    p_admin_password: adminPassword,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function updatePlayer(playerId, username, password, adminPassword) {
  const { error } = await supabase.rpc('update_player', {
    p_player_id: playerId,
    p_username: username,
    p_password: password || null,
    p_admin_password: adminPassword,
  })
  if (error) throw new Error(error.message)
}

export async function deletePlayer(playerId, adminPassword) {
  const { error } = await supabase.rpc('delete_player', {
    p_player_id: playerId,
    p_admin_password: adminPassword,
  })
  if (error) throw new Error(error.message)
}

const SIGNUP_MISSING =
  'Sign-up isn’t set up yet. Ask your admin to run the latest supabase/schema.sql.'
const missingFn = (error) => /could not find the function|does not exist/i.test(error.message)

// The link a new player opens to sign up (or an existing one, to join
// the campaign it's for).
export function inviteLink(token) {
  return `${window.location.origin}/?invite=${token}`
}

// The invite token from an invite link (…/?invite=TOKEN), if any.
export function inviteFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('invite')?.trim() || ''
  } catch {
    return ''
  }
}

export function clearInviteFromUrl() {
  window.history.replaceState(null, '', window.location.pathname)
}

// ── Account settings and password resets ──

const ACCOUNT_MISSING = 'Account settings aren’t set up yet. Ask your admin to run the latest supabase/schema.sql.'

// { username, displayName, emailHint } — the email comes back masked.
export async function getMyAccount(playerId) {
  const { data, error } = await supabase.rpc('get_my_account', { p_player_id: playerId })
  if (error) throw new Error(missingFn(error) ? ACCOUNT_MISSING : error.message)
  const row = data?.[0] || {}
  return { username: row.username || '', displayName: row.display_name || '', emailHint: row.email_hint || '' }
}

// Blank fields are left as they are. Needs the current password.
export async function updateMyAccount(playerId, { currentPassword, username, displayName, email, newPassword }) {
  const { error } = await supabase.rpc('update_my_account', {
    p_player_id: playerId,
    p_current_password: currentPassword,
    p_username: username?.trim() || null,
    p_display_name: displayName?.trim() || null,
    p_email: email?.trim() || null,
    p_new_password: newPassword || null,
  })
  if (error) throw new Error(missingFn(error) ? ACCOUNT_MISSING : error.message)
}

// "Forgot password?" — the database never says whether the account exists.
export async function requestPasswordReset(identifier) {
  const { error } = await supabase.rpc('request_password_reset', { p_identifier: identifier.trim() })
  if (error) throw new Error(missingFn(error) ? 'Password resets aren’t set up yet. Ask your DM or the admin directly.' : error.message)
}

export function resetLink(token) {
  return `${window.location.origin}/?reset=${token}`
}

export function resetFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('reset')?.trim() || ''
  } catch {
    return ''
  }
}

// Admin: open "Forgot password?" requests.
export async function listResetRequests(adminPassword) {
  const { data, error } = await supabase.rpc('list_password_reset_requests', { p_admin_password: adminPassword })
  if (error) {
    // An older database without resets just has no requests.
    if (missingFn(error)) return []
    throw new Error(error.message)
  }
  return data
}

export async function dismissResetRequest(requestId, adminPassword) {
  const { error } = await supabase.rpc('dismiss_password_reset_request', {
    p_admin_password: adminPassword,
    p_request_id: requestId,
  })
  if (error) throw new Error(error.message)
}

// Admin: a single-use reset link (24 hours) for a player.
export async function createPasswordReset(playerId, adminPassword) {
  const { data, error } = await supabase.rpc('create_password_reset', {
    p_admin_password: adminPassword,
    p_player_id: playerId,
  })
  if (error) throw new Error(missingFn(error) ? ACCOUNT_MISSING : error.message)
  return data
}

// { status: 'ok' | 'used' | 'expired' | 'invalid', username }
export async function checkPasswordReset(token) {
  const { data, error } = await supabase.rpc('check_password_reset', { p_token: token })
  if (error) throw new Error(missingFn(error) ? ACCOUNT_MISSING : error.message)
  return { status: data?.[0]?.status || 'invalid', username: data?.[0]?.username || '' }
}

// Sets the new password; resolves to the username.
export async function completePasswordReset(token, newPassword) {
  const { data, error } = await supabase.rpc('complete_password_reset', { p_token: token, p_new_password: newPassword })
  if (error) throw new Error(error.message)
  return data
}

// Admin: a single-use invite link, optionally joining a campaign on sign-up.
export async function createInvite({ campaignId = null, note = '' }, adminPassword) {
  const { data, error } = await supabase.rpc('create_player_invite', {
    p_admin_password: adminPassword,
    p_campaign_id: campaignId || null,
    p_note: note,
  })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return data[0]
}

export async function listInvites(adminPassword) {
  const { data, error } = await supabase.rpc('list_player_invites', { p_admin_password: adminPassword })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return data
}

export async function revokeInvite(inviteId, adminPassword) {
  const { error } = await supabase.rpc('revoke_player_invite', {
    p_admin_password: adminPassword,
    p_invite_id: inviteId,
  })
  if (error) throw new Error(error.message)
}

// DM: invite links for their own campaign (the database checks they're
// its DM or creator).
export async function createCampaignInvite(playerId, campaignId, note = '') {
  const { data, error } = await supabase.rpc('create_campaign_invite', {
    p_player_id: playerId,
    p_campaign_id: campaignId,
    p_note: note,
  })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return data[0]
}

export async function listCampaignInvites(playerId, campaignId) {
  const { data, error } = await supabase.rpc('list_campaign_invites', {
    p_player_id: playerId,
    p_campaign_id: campaignId,
  })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return data
}

export async function revokeCampaignInvite(playerId, inviteId) {
  const { error } = await supabase.rpc('revoke_campaign_invite', { p_player_id: playerId, p_invite_id: inviteId })
  if (error) throw new Error(error.message)
}

// Sign-up page: { status: 'ok' | 'used' | 'expired' | 'revoked' | 'invalid', campaignName }.
export async function checkInvite(token) {
  const { data, error } = await supabase.rpc('check_player_invite', { p_token: token })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return { status: data?.[0]?.status || 'invalid', campaignName: data?.[0]?.campaign_name || null }
}

// A player who already has an account joining the campaign an invite
// link is for. Resolves to { campaignId, campaignName }.
export async function acceptInvite(playerId, token) {
  const { data, error } = await supabase.rpc('accept_player_invite', { p_player_id: playerId, p_token: token })
  if (error) {
    throw new Error(
      missingFn(error) ? 'Joining with an invite link isn’t set up yet. Ask your DM for the join code instead.' : error.message,
    )
  }
  return { campaignId: data?.[0]?.campaign_id, campaignName: data?.[0]?.campaign_name }
}

// Sign-up with an invite link. Returns the new player's id; the database
// checks every field and explains what's wrong.
export async function registerPlayer({ token, username, displayName, password, email }) {
  const { data, error } = await supabase.rpc('register_player', {
    p_invite_token: token,
    p_username: username.trim(),
    p_display_name: displayName.trim(),
    p_password: password,
    p_email: email.trim(),
  })
  if (error) throw new Error(missingFn(error) ? SIGNUP_MISSING : error.message)
  return data
}

export async function verifyLogin(username, password) {
  const { data, error } = await supabase.rpc('verify_login', {
    p_username: username,
    p_password: password,
  })
  if (error) throw new Error(error.message)
  return data
}
