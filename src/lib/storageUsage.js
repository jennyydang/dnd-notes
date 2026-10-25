import { supabase } from './supabaseClient.js'
import { compressImage } from './imageCompress.js'
import { AUDIO_BUCKET, loadRecordingBlob, replaceAudioFile } from './sessionRecorder.js'

// What's using the Supabase project's file storage, and shrinking what's
// already there (new uploads are shrunk on the way in; see
// imageCompress.js and audioExport.js). Admin-only: storage is shared by
// every campaign.

// Supabase's Free plan includes 1GB of file storage.
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024

export const STORAGE_BUCKETS = [
  { id: 'session-audio', label: 'Session recordings', icon: 'mic' },
  { id: 'maps', label: 'Maps', icon: 'map' },
  { id: 'campaign-art', label: 'Art', icon: 'image' },
  { id: 'campaign-covers', label: 'Campaign covers', icon: 'image' },
  { id: 'player-backgrounds', label: 'Backgrounds', icon: 'image' },
  { id: 'npc-portraits', label: 'NPC portraits', icon: 'users' },
  { id: 'party-portraits', label: 'Party portraits', icon: 'users' },
  { id: 'player-avatars', label: 'Profile pictures', icon: 'users' },
  { id: 'loot-photos', label: 'Loot', icon: 'image' },
  { id: 'creature-photos', label: 'Creatures', icon: 'image' },
  { id: 'map-marker-photos', label: 'Map pins', icon: 'image' },
]
export const bucketLabel = (id) => STORAGE_BUCKETS.find((b) => b.id === id)?.label || id

export function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${Number((bytes / 1024 ** 3).toFixed(2))}GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : 1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

const PAGE = 1000

async function listFolder(bucket, folder = '') {
  const files = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: PAGE, offset })
    if (error) throw new Error(`${bucketLabel(bucket)}: ${error.message}`)
    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name
      if (item.id == null) files.push(...(await listFolder(bucket, path))) // a folder
      else if (item.name !== '.emptyFolderPlaceholder') {
        files.push({
          bucket,
          path,
          size: item.metadata?.size || 0,
          type: item.metadata?.mimetype || '',
          updatedAt: item.updated_at || item.created_at,
        })
      }
    }
    if (data.length < PAGE) return files
  }
}

// Every stored file, biggest first, with totals per bucket.
export async function loadStorageUsage() {
  const lists = await Promise.all(STORAGE_BUCKETS.map((b) => listFolder(b.id)))
  const files = lists.flat().sort((a, b) => b.size - a.size)
  const byBucket = Object.fromEntries(STORAGE_BUCKETS.map((b) => [b.id, { bytes: 0, count: 0 }]))
  for (const f of files) {
    byBucket[f.bucket].bytes += f.size
    byBucket[f.bucket].count += 1
  }
  return { files, byBucket, total: files.reduce((sum, f) => sum + f.size, 0) }
}

// Shrinking has to save at least this much to be worth replacing a file
// (and re-compressing an already-compressed picture loses a little detail).
const MIN_SAVING = 0.1

async function shrinkImage(file) {
  const url = supabase.storage.from(file.bucket).getPublicUrl(file.path).data.publicUrl
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Couldn’t download it.')
  const blob = await res.blob()
  const original = new File([blob], file.path, { type: blob.type || file.type })
  const smaller = await compressImage(original, file.bucket)
  // WebP is already compressed: only replace it when it was oversized.
  const needed = original.type === 'image/webp' ? 0.3 : MIN_SAVING
  if (smaller === original || smaller.size > original.size * (1 - needed)) return null
  // Same key, so everything pointing at the picture keeps working.
  const { error } = await supabase.storage
    .from(file.bucket)
    .upload(file.path, smaller, { upsert: true, contentType: smaller.type })
  if (error) throw new Error(error.message)
  return { before: original.size, after: smaller.size }
}

// The recap a recording file belongs to (one file may be a piece of it).
async function recapFor(path) {
  const { data } = await supabase.from('session_notes').select('*').eq('audio_path', path).maybeSingle()
  if (data) return data
  const { data: rows } = await supabase.from('session_notes').select('*').not('audio_parts', 'is', null)
  return (rows || []).find((r) => Array.isArray(r.audio_parts) && r.audio_parts.includes(path)) || null
}

async function shrinkAudio(file, onProgress) {
  const row = await recapFor(file.path)
  if (!row) return null // not attached to any recap
  const session = { audioPath: row.audio_path, audioParts: row.audio_parts }
  const blob = await loadRecordingBlob(session)
  const before = blob.size
  const { shrinkRecording } = await import('./audioExport.js')
  const name = row.audio_path.replace(/-part\d+of\d+(?=\.)/, '')
  const original = new File([blob], name, { type: blob.type })
  const smaller = await shrinkRecording(original, row.audio_seconds, onProgress)
  if (smaller === original) return null
  await replaceAudioFile(row.id, smaller, row.audio_seconds)
  return { before, after: smaller.size, replaced: Array.isArray(row.audio_parts) ? row.audio_parts : [row.audio_path] }
}

// Re-saves one stored file smaller, if that helps. Resolves to
// { before, after } (bytes), or null when it's already as light as it
// sensibly gets. Recording pieces are shrunk as their whole recording.
export function shrinkStoredFile(file, onProgress) {
  return file.bucket === AUDIO_BUCKET ? shrinkAudio(file, onProgress) : shrinkImage(file)
}
