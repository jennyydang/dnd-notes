import { supabase } from './supabaseClient.ts'
import { getPlayerSession } from './auth.js'

// Offline support for everything that goes through useSupabaseTable:
//
// - Read cache: every successful table load is remembered on this device,
//   so a screen that was opened once still shows its rows with no network.
// - Outbox: inserts, updates and deletes made while offline are queued in
//   localStorage (surviving a reload) and replayed in order once the
//   connection is back. While anything is queued, new writes queue behind
//   it too, so they always reach the server in the order they were made.
//
// The pure helpers (coalesceOp, applyOps, matchesFilters, sortRows) take
// their data as arguments so they can be unit tested without a browser.

const CACHE_PREFIX = 'dnd-notes-cache:'
const OUTBOX_KEY = 'dnd-notes-outbox'
const FAILED_KEY = 'dnd-notes-outbox-failed'
const RETRY_MS = 30000

// Fired with { detail: { tables } } after queued writes reach the server,
// and with no tables when the connection comes back, so every mounted
// table refetches whatever it missed.
export const RESYNC_EVENT = 'dnd-notes-resync'

// ── Pure helpers ────────────────────────────────────────────────────────

export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = typeof error === 'string' ? error : error?.message || ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected/i.test(
    message,
  )
}

export function matchesFilters(row, filters) {
  return Object.entries(filters).every(([column, value]) =>
    Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
  )
}

export function sortRows(rows, orderBy, ascending) {
  const direction = ascending ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[orderBy]
    const y = b[orderBy]
    if (x === y) return 0
    if (x == null) return 1
    if (y == null) return -1
    return x < y ? -direction : direction
  })
}

// Adds `op` to `ops`, folding it into what's already queued for the same
// row: an update merges into a queued insert or update, and deleting a
// row that was only ever created offline drops it entirely. `inFlight` is
// the opId currently being sent: it's never changed or dropped, since the
// server may already have it.
export function coalesceOp(ops, op, inFlight = null) {
  const sameRow = (o) => o.table === op.table && o.rowId === op.rowId
  if (op.kind === 'update') {
    const lastIndex = ops.findLastIndex(sameRow)
    const last = ops[lastIndex]
    if (last && last.opId !== inFlight && (last.kind === 'insert' || last.kind === 'update')) {
      const next = [...ops]
      next[lastIndex] = { ...last, payload: { ...last.payload, ...op.payload } }
      if (last.local) next[lastIndex].local = { ...last.local, ...op.payload }
      return next
    }
    return [...ops, op]
  }
  if (op.kind === 'delete') {
    const rest = ops.filter((o) => !sameRow(o) || o.opId === inFlight)
    const createdOffline = ops.some((o) => sameRow(o) && o.kind === 'insert' && o.opId !== inFlight)
    return createdOffline ? rest : [...rest, op]
  }
  return [...ops, op]
}

// The rows a table would hold once `ops` reach the server.
export function applyOps(rows, ops, { table, filters = {}, orderBy = 'created_at', ascending = true }) {
  let result = rows
  for (const op of ops) {
    if (op.table !== table) continue
    if (op.kind === 'insert') {
      if (matchesFilters(op.local, filters) && !result.some((r) => r.id === op.rowId)) {
        result = [...result, op.local]
      }
    } else if (op.kind === 'update') {
      result = result.map((r) => (r.id === op.rowId ? { ...r, ...op.payload } : r))
    } else if (op.kind === 'delete') {
      result = result.filter((r) => r.id !== op.rowId)
    }
  }
  return result === rows ? rows : sortRows(result, orderBy, ascending)
}

// ── Storage ─────────────────────────────────────────────────────────────

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function cacheKeys() {
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key)
    }
  } catch {
    // Storage blocked: nothing cached.
  }
  return keys
}

// Cached rows are per player, so a shared device never shows one
// player's private notes to the next person who logs in.
export function cacheKey(table, { orderBy, ascending, filterKey }) {
  const viewer = getPlayerSession()?.playerId || 'admin'
  return `${CACHE_PREFIX}${viewer}:${table}:${orderBy}:${ascending ? 'asc' : 'desc'}:${filterKey}`
}

export function readCache(key) {
  return readJson(key, null)
}

export function writeCache(key, rows) {
  if (writeJson(key, rows)) return
  // Out of space: the cache is only a convenience, so start it over.
  clearCache()
  writeJson(key, rows)
}

export function clearCache() {
  for (const key of cacheKeys()) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

// ── Outbox and sync status ──────────────────────────────────────────────

let outbox = readJson(OUTBOX_KEY, [])
let failed = readJson(FAILED_KEY, [])
let syncing = false
let inFlight = null
let online = typeof navigator === 'undefined' ? true : navigator.onLine
let snapshot = null
const listeners = new Set()

function emit() {
  snapshot = null
  for (const listener of listeners) listener()
}

function saveOutbox(next) {
  outbox = next
  writeJson(OUTBOX_KEY, outbox)
  emit()
}

export function getOutbox() {
  return outbox
}

export function hasPendingWrites() {
  return outbox.length > 0
}

// For useSyncExternalStore: { online, pending, syncing, failed }.
export function getSyncStatus() {
  if (!snapshot) snapshot = { online, pending: outbox.length, syncing, failed }
  return snapshot
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function dismissFailed() {
  failed = []
  writeJson(FAILED_KEY, failed)
  emit()
}

function newId() {
  return crypto.randomUUID()
}

// Queues a write and returns the row as it will look once it's saved.
// `current` is the row as this device last saw it (for updates).
export function queueWrite({ table, kind, rowId, payload = {}, current = null }) {
  const now = new Date().toISOString()
  let op
  if (kind === 'insert') {
    const id = payload.id || newId()
    const row = { ...payload, id }
    // `local` also carries timestamps so the row sorts where it will end
    // up; only `payload` is sent to the server, leaving the real
    // timestamps to the database defaults.
    op = { opId: newId(), table, kind, rowId: id, payload: row, local: { created_at: now, updated_at: now, ...row } }
  } else {
    op = { opId: newId(), table, kind, rowId, payload }
  }
  saveOutbox(coalesceOp(outbox, op, inFlight))
  scheduleFlush()
  if (kind === 'insert') return op.local
  if (kind === 'update') return { ...(current || { id: rowId }), ...payload }
  return null
}

async function send(op) {
  if (op.kind === 'insert') {
    const { error } = await supabase.from(op.table).insert(op.payload)
    // Already there: an earlier attempt reached the server but its reply
    // didn't make it back.
    if (error && error.code === '23505') return null
    return error
  }
  if (op.kind === 'update') {
    const { error } = await supabase.from(op.table).update(op.payload).eq('id', op.rowId)
    return error
  }
  const { error } = await supabase.from(op.table).delete().eq('id', op.rowId)
  return error
}

function announce(tables) {
  window.dispatchEvent(new CustomEvent(RESYNC_EVENT, { detail: { tables } }))
}

// Sends queued writes one at a time, oldest first. Stops at the first
// network failure (the rest wait for the next try); a write the server
// rejects is set aside and reported rather than retried forever.
export async function flushOutbox() {
  if (syncing || outbox.length === 0) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  syncing = true
  emit()
  const touched = new Set()
  try {
    while (outbox.length > 0) {
      const op = outbox[0]
      let error
      inFlight = op.opId
      try {
        error = await send(op)
      } catch (err) {
        error = err
      } finally {
        inFlight = null
      }
      if (error && isNetworkError(error)) break
      if (error) {
        failed = [...failed, { table: op.table, kind: op.kind, message: error.message || String(error) }]
        writeJson(FAILED_KEY, failed)
      }
      touched.add(op.table)
      // Re-read rather than slice the array we started with: a write
      // queued while this one was in flight may have been folded into it.
      saveOutbox(outbox.filter((o) => o.opId !== op.opId))
    }
  } finally {
    syncing = false
    emit()
    if (touched.size) announce([...touched])
    if (outbox.length) scheduleFlush(RETRY_MS)
  }
}

let flushTimer = null
function scheduleFlush(delay = 0) {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => flushOutbox(), delay)
}

let started = false
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => {
    online = true
    emit()
    flushOutbox().finally(() => announce(null))
  })
  window.addEventListener('offline', () => {
    online = false
    emit()
  })
  if (outbox.length) scheduleFlush()
}
