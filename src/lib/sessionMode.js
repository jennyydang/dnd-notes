// Live-session helpers: the "session in progress" marker, per-device UI
// state kept in localStorage (never user content — that lives in Supabase),
// and turning quick notes into a session recap without retyping them.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode) — the feature just won't
    // survive a refresh; nothing the user typed is lost from Supabase.
  }
}

const activeKey = (campaignId, playerId) => `dnd-notes-active-session:${campaignId}:${playerId || 'admin'}`
const encounterKey = (campaignId) => `dnd-notes-encounter:${campaignId}`

// { startedAt: ISO string, paused: bool } or null.
export const getActiveSession = (campaignId, playerId) => read(activeKey(campaignId, playerId), null)
export const setActiveSession = (campaignId, playerId, value) => write(activeKey(campaignId, playerId), value)

export const getEncounter = (campaignId) => read(encounterKey(campaignId), null)
export const setEncounter = (campaignId, value) => write(encounterKey(campaignId), value)

export const getStored = read
export const setStored = write

export function formatTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function todayIso(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Oldest first, one bullet per note, prefixed with its time — the same
// HTML shape the recap editor produces, so it opens ready to edit.
export function quickNotesToRecapHtml(notes) {
  const sorted = [...notes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  if (!sorted.length) return ''
  const items = sorted
    .map((note) => {
      const time = formatTime(note.createdAt)
      const lines = escapeHtml(note.content.trim()).split('\n').join('<br>')
      return `<li><p>${time ? `<strong>${time}</strong> — ` : ''}${lines}</p></li>`
    })
    .join('')
  return `<ul>${items}</ul>`
}
