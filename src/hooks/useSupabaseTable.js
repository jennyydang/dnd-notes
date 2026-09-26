import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const identity = (row) => row
const noFilters = {}

const CHANGE_EVENT = 'supabase-table-changed'

// Each hook instance keeps its own copy of a table with no realtime
// subscription, so a row written by one view (e.g. an NPC created from
// Session Mode while the Home hub is also showing NPCs) wouldn't otherwise
// show up elsewhere until a remount. Every add/update/remove made through
// this hook broadcasts the change, and every other mounted instance of
// that table quietly refetches. `source` lets the writer skip itself.
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

  const fromRowRef = useRef(fromRow)
  fromRowRef.current = fromRow

  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const filterKey = JSON.stringify(filters)

  const requestIdRef = useRef(0)
  const instanceRef = useRef(null)
  if (!instanceRef.current) instanceRef.current = {}

  // `silent` refetches (after someone else's write) keep showing the
  // current rows instead of flashing every list back to "Loading…".
  const load = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestIdRef.current
    if (!silent) setLoading(true)
    setError(null)
    let query = supabase.from(table).select('*').order(orderBy, { ascending })
    for (const [column, value] of Object.entries(filtersRef.current)) {
      query = query.eq(column, value)
    }
    const { data, error: fetchError } = await query

    if (requestIdRef.current !== requestId) return // superseded by a newer load()

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setItems(data.map((row) => fromRowRef.current(row)))
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
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [table, load])

  const addItem = useCallback(
    async (payload) => {
      const row = { ...payload, ...filtersRef.current }
      const { data, error: insertError } = await supabase
        .from(table)
        .insert(row)
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)
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
    [table, load],
  )

  const updateItem = useCallback(
    async (id, patch) => {
      const { data, error: updateError } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)
      const item = fromRowRef.current(data)
      // Same reasoning as addItem: an edit can change the very column
      // being ordered by (e.g. a session note's date), so refetch instead
      // of patching in place to keep the list correctly ordered.
      await load({ silent: true })
      notifyTableChanged(table, instanceRef.current)
      return item
    },
    [table, load],
  )

  const removeItem = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) throw new Error(deleteError.message)
      setItems((prev) => prev.filter((item) => item.id !== id))
      notifyTableChanged(table, instanceRef.current)
    },
    [table],
  )

  return { items, loading, error, addItem, updateItem, removeItem, refetch: load }
}
