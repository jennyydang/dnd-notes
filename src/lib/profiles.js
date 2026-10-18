import { useEffect, useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.ts'
import { getPublicUrl, removeImage, uploadImage } from './storage.js'

// Players' profile pictures (player_profiles + the "player-avatars"
// bucket). Pictures are cached here per player and shared by everything
// that shows one (the account button, the online-players faces), so a
// new upload shows up everywhere at once.

const BUCKET = 'player-avatars'
const MISSING_TABLE =
  'Profile pictures aren’t set up on this database yet. Run the latest supabase/schema.sql in Supabase, then try again.'

const paths = new Map() // playerId → avatar_path | null (null = none)
const loading = new Map() // playerId → Promise
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function friendly(error) {
  const message = error?.message || String(error)
  return /player_profiles|relation .* does not exist|bucket not found/i.test(message) ? MISSING_TABLE : message
}

export function avatarUrl(path) {
  return path ? getPublicUrl(BUCKET, path) : ''
}

export function loadAvatar(playerId) {
  if (!playerId || !isSupabaseConfigured) return Promise.resolve()
  if (paths.has(playerId)) return Promise.resolve()
  if (!loading.has(playerId)) {
    const request = supabase
      .from('player_profiles')
      .select('avatar_path')
      .eq('player_id', playerId)
      .maybeSingle()
      .then(({ data, error }) => {
        // A failed read (offline, table not created yet) just means "no
        // picture"; the initial is shown instead. Try again next time.
        if (!error) {
          paths.set(playerId, data?.avatar_path || null)
          emit()
        }
      })
      .finally(() => loading.delete(playerId))
    loading.set(playerId, request)
  }
  return loading.get(playerId)
}

export async function setAvatar(playerId, file) {
  const previous = paths.get(playerId) || null
  let path
  try {
    path = await uploadImage(BUCKET, file)
  } catch (err) {
    throw new Error(friendly(err))
  }
  const { error } = await supabase
    .from('player_profiles')
    .upsert({ player_id: playerId, avatar_path: path, updated_at: new Date().toISOString() })
  if (error) {
    await removeImage(BUCKET, path)
    throw new Error(friendly(error))
  }
  paths.set(playerId, path)
  emit()
  if (previous) removeImage(BUCKET, previous).catch(() => {})
}

export async function clearAvatar(playerId) {
  const previous = paths.get(playerId) || null
  const { error } = await supabase
    .from('player_profiles')
    .upsert({ player_id: playerId, avatar_path: null, updated_at: new Date().toISOString() })
  if (error) throw new Error(friendly(error))
  paths.set(playerId, null)
  emit()
  if (previous) removeImage(BUCKET, previous).catch(() => {})
}

// The player's picture URL, or '' while loading / when they have none.
export function usePlayerAvatar(playerId) {
  useEffect(() => {
    loadAvatar(playerId)
  }, [playerId])
  const path = useSyncExternalStore(subscribe, () => (playerId ? paths.get(playerId) || null : null))
  return avatarUrl(path)
}
