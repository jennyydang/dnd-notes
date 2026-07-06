import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const identity = (row) => row
const noFilters = {}

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

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
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
      setItems((prev) => [...prev, item])
      return item
    },
    [table],
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
      setItems((prev) => prev.map((existing) => (existing.id === id ? item : existing)))
      return item
    },
    [table],
  )

  const removeItem = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) throw new Error(deleteError.message)
      setItems((prev) => prev.filter((item) => item.id !== id))
    },
    [table],
  )

  return { items, loading, error, addItem, updateItem, removeItem, refetch: load }
}
