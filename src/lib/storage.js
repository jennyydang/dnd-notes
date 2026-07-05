import { supabase } from './supabaseClient.js'

export function getPublicUrl(bucket, path) {
  if (!path) return ''
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function uploadImage(bucket, file) {
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
