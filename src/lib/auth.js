import { supabase } from './supabaseClient.js'

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

export async function verifyLogin(username, password) {
  const { data, error } = await supabase.rpc('verify_login', {
    p_username: username,
    p_password: password,
  })
  if (error) throw new Error(error.message)
  return data
}
