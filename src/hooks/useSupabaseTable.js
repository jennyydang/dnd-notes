import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const identity = (row) => row

export function useSupabaseTable(
  table,
  { fromRow = identity, orderBy = 'created_at', ascending = true, campaignId } = {},
) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fromRowRef = useRef(fromRow)
  fromRowRef.current = fromRow

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      let query = supabase.from(table).select('*').order(orderBy, { ascending })
      if (campaignId) query = query.eq('campaign_id', campaignId)
      const { data, error: fetchError } = await query

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setItems(data.map((row) => fromRowRef.current(row)))
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [table, orderBy, ascending, campaignId])

  const addItem = useCallback(
    async (payload) => {
      const row = campaignId ? { ...payload, campaign_id: campaignId } : payload
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
    [table, campaignId],
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

  return { items, loading, error, addItem, updateItem, removeItem }
}
