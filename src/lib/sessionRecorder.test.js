import { beforeEach, describe, expect, it, vi } from 'vitest'

// An in-memory stand-in for Supabase: one session_notes row and a bucket.
const store = { row: null, files: new Map(), maxUpload: 50 * 1024 * 1024 }
vi.mock('./supabaseClient.js', () => {
  const table = () => {
    const api = {
      select: () => api,
      eq: () => api,
      single: async () => ({ data: { ...store.row }, error: null }),
      update: (patch) => ({
        eq: async () => {
          Object.assign(store.row, patch)
          return { error: null }
        },
      }),
    }
    return api
  }
  const bucket = () => ({
    upload: async (path, blob) => {
      if (blob.size > store.maxUpload) return { error: { message: 'The object exceeded the maximum allowed size' } }
      store.files.set(path, blob)
      return { error: null }
    },
    remove: async (paths) => {
      paths.forEach((p) => store.files.delete(p))
      return { error: null }
    },
    getPublicUrl: (path) => ({ data: { publicUrl: `mem://${path}` } }),
  })
  return { supabase: { from: table, storage: { from: bucket } } }
})

const rec = await import('./sessionRecorder.js')

// Audio metadata can't be read in Node; the upload carries on without a length.
globalThis.Audio = class {
  set src(_) {
    setTimeout(() => this.onerror?.())
  }
}
globalThis.fetch = async (url) => {
  const blob = store.files.get(url.replace('mem://', ''))
  return blob ? { ok: true, blob: async () => blob } : { ok: false }
}

const fromRow = (r) => ({ id: r.id, title: 'Session 4', audioPath: r.audio_path, audioParts: r.audio_parts || null })
function fileOf(size, name = 'long.mp3') {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i += 4096) bytes[i] = (i / 4096) % 251
  return new File([bytes], name, { type: 'audio/mpeg' })
}

beforeEach(() => {
  store.row = { id: 's1', audio_path: null, audio_parts: null }
  store.files.clear()
})

describe('recordings over the upload limit', () => {
  it('stores a small file as one piece', async () => {
    await rec.uploadAudioFile('s1', fileOf(1024 * 1024, 'short.mp3'))
    expect(store.files.size).toBe(1)
    expect(store.row.audio_parts).toBeNull()
    expect(rec.isSplitRecording(fromRow(store.row))).toBe(false)
  })

  it('splits a big file into pieces under 50MB and joins them back exactly', async () => {
    const file = fileOf(98 * 1024 * 1024)
    await rec.uploadAudioFile('s1', file)
    const session = fromRow(store.row)
    expect(store.row.audio_parts).toHaveLength(3)
    expect(store.row.audio_path).toBe(store.row.audio_parts[0])
    for (const blob of store.files.values()) expect(blob.size).toBeLessThanOrEqual(rec.PART_BYTES)

    const progress = []
    const joined = await rec.loadRecordingBlob(session, (p) => progress.push(p))
    expect(progress.at(-1)).toBe(1)
    expect(joined.size).toBe(file.size)
    expect(joined.type).toBe('audio/mpeg')
    expect(Buffer.compare(new Uint8Array(await joined.arrayBuffer()), new Uint8Array(await file.arrayBuffer()))).toBe(0)
  })

  it('replacing or removing a split recording deletes every piece', async () => {
    await rec.uploadAudioFile('s1', fileOf(60 * 1024 * 1024))
    expect(store.files.size).toBe(2)
    await rec.uploadAudioFile('s1', fileOf(1024, 'short.mp3'))
    expect([...store.files.keys()]).toEqual([store.row.audio_path])
    expect(store.row.audio_parts).toBeNull()

    await rec.uploadAudioFile('s1', fileOf(60 * 1024 * 1024))
    await rec.removeAudio('s1', fromRow(store.row))
    expect(store.files.size).toBe(0)
    expect(store.row).toMatchObject({ audio_path: null, audio_parts: null })
  })

  it('still refuses anything over 100MB', async () => {
    await expect(rec.uploadAudioFile('s1', fileOf(101 * 1024 * 1024))).rejects.toThrow(/over 100MB/)
    expect(store.files.size).toBe(0)
  })
})
