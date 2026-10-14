import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { subscribeToTable } from '../lib/realtime.js'
import {
  RESYNC_EVENT,
  applyOps,
  cacheKey,
  getOutbox,
  hasPendingWrites,
  isNetworkError,
  queueWrite,
  readCache,
  writeCache,
} from '../lib/offline.js'

const identity = (row) => row
const noFilters = {}

const CHANGE_EVENT = 'supabase-table-changed'
const REALTIME_DEBOUNCE_MS = 250

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
// Writes are queued rather than sent when offline, and also while earlier
// queued writes haven't gone through yet, so they reach the server in order.
const shouldQueue = () => isOffline() || hasPendingWrites()

// Each hook instance keeps its own copy of a table. A row written by one
// view (e.g. an NPC created from Session Mode while the Home hub is also
// showing NPCs) is broadcast on this device, and every other mounted
// instance of that table quietly refetches; `source` lets the writer skip
// itself. Writes from other players' devices arrive through Supabase
// Realtime (lib/realtime.js) and trigger the same quiet refetch.
//
// Offline (lib/offline.js): the last rows loaded are cached on the device
// and shown when the network is unreachable (`stale` is then true), and
// writes are queued and sent once the connection is back. Queued writes
// are applied on top of whatever is loaded, so every screen shows them
// straight away.
export function notifyTableChanged(table, source = null) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { table, source } }))
}

export function useSupabaseTable(
  table,
  { fromRow = identity, orderBy = 'created_at', ascending = true, filters = noFilters } = {},
) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  const fromRowRef = useRef(fromRow)
  fromRowRef.current = fromRow

  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const filterKey = JSON.stringify(filters)

  const rowsRef = useRef([])
  const requestIdRef = useRef(0)
  const instanceRef = useRef(null)
  if (!instanceRef.current) instanceRef.current = {}

  // `silent` refetches (after someone else's write) keep showing the
  // current rows instead of flashing every list back to "Loading…".
  const load = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestIdRef.current
    if (!silent) setLoading(true)
    setError(null)
    // An array filter means "column is one of these values"; an empty one
    // matches nothing, so skip the round trip.
    const entries = Object.entries(filtersRef.current)
    if (entries.some(([, value]) => Array.isArray(value) && value.length === 0)) {
      if (requestIdRef.current === requestId) {
        setItems([])
        setLoading(false)
      }
      return
    }
    const key = cacheKey(table, { orderBy, ascending, filterKey: JSON.stringify(filtersRef.current) })
    let data = null
    let fetchError = null
    if (isOffline()) {
      fetchError = new Error('You’re offline.')
    } else {
      let query = supabase.from(table).select('*').order(orderBy, { ascending })
      for (const [column, value] of entries) {
        query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value)
      }
      try {
        ;({ data, error: fetchError } = await query)
      } catch (err) {
        fetchError = err
      }
    }

    if (requestIdRef.current !== requestId) return // superseded by a newer load()

    let rows = null
    if (!fetchError) {
      writeCache(key, data)
      rows = data
      setStale(false)
    } else if (isNetworkError(fetchError)) {
      const cached = readCache(key)
      const queued = getOutbox().some((op) => op.table === table)
      if (cached || queued) {
        rows = cached || []
        setStale(true)
      } else {
        setError('You’re offline, and this hasn’t been opened on this device before.')
      }
    } else {
      setError(fetchError.message)
    }
    if (rows) {
      const withQueued = applyOps(rows, getOutbox(), { table, filters: filtersRef.current, orderBy, ascending })
      rowsRef.current = withQueued
      setItems(withQueued.map((row) => fromRowRef.current(row)))
    }
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => {
    load()
    // filterKey deliberately triggers a refetch even though `load` itself
    // reads filters via a ref (so its own identity doesn't depend on them).
  }, [load, filterKey])

  useEffect(() => {
    function onChange(event) {
      const { table: changed, source } = event.detail || {}
      if (changed === table && source !== instanceRef.current) load({ silent: true })
    }
    function onResync(event) {
      const tables = event.detail?.tables
      if (!tables || tables.includes(table)) load({ silent: true })
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener(RESYNC_EVENT, onResync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener(RESYNC_EVENT, onResync)
    }
  }, [table, load])

  // Other devices' writes. Bursts (a whole recap saving, several pins
  // moving) collapse into one refetch.
  useEffect(() => {
    let timer = null
    const unsubscribe = subscribeToTable(table, filtersRef.current, (payload) => {
      if (payload.eventType === 'DELETE' && !rowsRef.current.some((row) => row.id === payload.old?.id)) return
      clearTimeout(timer)
      timer = setTimeout(() => load({ silent: true }), REALTIME_DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
    // filterKey stands in for the filters object, as above.
  }, [table, load, filterKey])

  const queued = useCallback(
    async (write) => {
      const row = queueWrite({ table, ...write })
      await load({ silent: true })
      notifyTableChanged(table, instanceRef.current)
      return row
    },
    [table, load],
  )

  const addItem = useCallback(
    async (payload) => {
      // Scalar filters are written onto new rows (e.g. campaign_id); list
      // filters only narrow reads.
      const scalarFilters = Object.fromEntries(
        Object.entries(filtersRef.current).filter(([, value]) => !Array.isArray(value)),
      )
      const row = { ...payload, ...scalarFilters }
      if (shouldQueue()) return fromRowRef.current(await queued({ kind: 'insert', payload: row }))
      const { data, error: insertError } = await supabase
        .from(table)
        .insert(row)
        .select()
        .single()

      if (insertError) {
        if (isNetworkError(insertError)) return fromRowRef.current(await queued({ kind: 'insert', payload: row }))
        throw new Error(insertError.message)
      }
      const item = fromRowRef.current(data)
      // Refetch rather than append locally: appending always puts the new
      // row last, which is wrong whenever orderBy/ascending sorts by
      // anything other than "oldest first" (e.g. session notes ordered by
      // date, newest first) — refetching keeps local state in the same
      // order the server would return it in.
      await load({ silent: true })
      notifyTableChanged(table, instanceRef.current)
      return item
    },
    [table, load, queued],
  )

  const updateItem = useCallback(
    async (id, patch) => {
      const queueIt = async () => {
        const current = rowsRef.current.find((row) => row.id === id) || null
        return fromRowRef.current(await queued({ kind: 'update', rowId: id, payload: patch, current }))
      }
      if (shouldQueue()) return queueIt()
      const { data, error: updateError } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        if (isNetworkError(updateError)) return queueIt()
        throw new Error(updateError.message)
      }
      const item = fromRowRef.current(data)
      // Same reasoning as addItem: an edit can change the very column
      // being ordered by (e.g. a session note's date), so refetch instead
      // of patching in place to keep the list correctly ordered.
      await load({ silent: true })
      notifyTableChanged(table, instanceRef.current)
      return item
    },
    [table, load, queued],
  )

  const removeItem = useCallback(
    async (id) => {
      if (shouldQueue()) {
        await queued({ kind: 'delete', rowId: id })
        return
      }
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) {
        if (isNetworkError(deleteError)) {
          await queued({ kind: 'delete', rowId: id })
          return
        }
        throw new Error(deleteError.message)
      }
      rowsRef.current = rowsRef.current.filter((row) => row.id !== id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      notifyTableChanged(table, instanceRef.current)
    },
    [table, queued],
  )

  return { items, loading, error, stale, addItem, updateItem, removeItem, refetch: load }
}
