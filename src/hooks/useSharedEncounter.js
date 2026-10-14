import { useCallback, useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'
import { supabase } from '../lib/supabaseClient.js'
import { emptyEncounter, normalizeEncounter } from '../lib/initiative.js'
import { getEncounter, setEncounter } from '../lib/sessionMode.js'

const identity = (row) => row

// The campaign's live encounter, shared by every device through the
// `encounters` table (one row per campaign; Realtime brings other devices'
// changes in). `update(change)` applies a change — a function of the
// current state — on this screen at once and saves it; saves go out one
// at a time, in order. Until the database has the table, it falls back to
// this device's storage (`shared` is then false).
export function useSharedEncounter(campaignId) {
  const table = useSupabaseTable('encounters', {
    fromRow: identity,
    orderBy: 'updated_at',
    filters: { campaign_id: campaignId },
  })
  const { items, error, loading, addItem, updateItem } = table
  const shared = !error
  const row = items[0] || null

  const [local, setLocal] = useState(() => normalizeEncounter(getEncounter(campaignId)))
  const [pending, setPending] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const remote = row ? normalizeEncounter(row.state) : emptyEncounter()
  const state = !shared ? local : pending || remote

  const stateRef = useRef(state)
  stateRef.current = state
  const rowIdRef = useRef(null)
  rowIdRef.current = row?.id || rowIdRef.current
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    if (!shared) setEncounter(campaignId, local.combatants.length ? local : null)
  }, [shared, campaignId, local])

  const write = useCallback(
    async (next) => {
      const payload = { state: next, updated_at: new Date().toISOString() }
      if (rowIdRef.current) {
        await updateItem(rowIdRef.current, payload)
        return
      }
      try {
        const created = await addItem(payload)
        rowIdRef.current = created.id
      } catch (err) {
        // Another device created the campaign's row first: save over it.
        if (!/duplicate|unique/i.test(err.message)) throw err
        const { data, error: readError } = await supabase.from('encounters').select('id').eq('campaign_id', campaignId)
        if (readError || !data?.length) throw err
        rowIdRef.current = data[0].id
        await updateItem(rowIdRef.current, payload)
      }
    },
    [addItem, updateItem, campaignId],
  )

  const update = useCallback(
    (change) => {
      const next = change(stateRef.current)
      if (next === stateRef.current) return
      stateRef.current = next
      if (!shared) {
        setLocal(next)
        return
      }
      setPending(next)
      queueRef.current = queueRef.current
        .then(() => write(next))
        .then(() => setSaveError(null))
        .catch((err) => setSaveError(err.message))
        // Show the saved row again once nothing newer is waiting.
        .finally(() => setPending((p) => (p === next ? null : p)))
    },
    [shared, write],
  )

  return { state, update, shared, loading: shared && loading, error: saveError }
}
