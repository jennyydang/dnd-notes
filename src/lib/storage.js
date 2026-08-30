import { supabase } from './supabaseClient.js'

// Generous for a portrait/cover photo, but without this an oversized file
// (an unconverted high-res phone photo, say) has no fast failure path — it
// just sits mid-upload as long as the browser lets the request run, which
// from the form looks identical to the save silently doing nothing.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function getPublicUrl(bucket, path) {
  if (!path) return ''
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function uploadImage(bucket, file) {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Photo is too large (max 8MB) — try a smaller image or a compressed export.')
  }
  const ext = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error
  return path
}

export async function removeImage(bucket, path) {
  if (!path) return
  await supabase.storage.from(bucket).remove([path])
}
