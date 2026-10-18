import { useCallback, useEffect, useRef, useState } from 'react'
import { notifyTableChanged, useSupabaseTable } from './useSupabaseTable.js'
import { supabase } from '../lib/supabaseClient.ts'
import { emptyEncounter, normalizeEncounter } from '../lib/initiative.js'
import { getEncounter, setEncounter } from '../lib/sessionMode.js'
import { isNetworkError } from '../lib/offline.js'

const MAX_ATTEMPTS = 6

const identity = (row) => row

// The campaign's live encounter, shared by every device through the
// `encounters` table (one row per campaign; Realtime brings other devices'
// changes in). `update(change)` applies a change — a pure function of the
// state — on this screen at once, then saves it by re-applying it to the
// latest saved state; saves go out one at a time, in order. Until the database has the table, it falls back to
// this device's storage (`shared` is then false).
export function useSharedEncounter(campaignId) {
  const table = useSupabaseTable('encounters', {
    fromRow: identity,
    orderBy: 'updated_at',
    filters: { campaign_id: campaignId },
  })
  const { items, error, loading, addItem, updateItem, refetch } = table
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

  // Read-modify-write against the latest saved encounter, saved only if
  // nobody else saved in between (matched on updated_at), retrying
  // otherwise. So two players' rolls landing together can't overwrite
  // each other.
  const writeChange = useCallback(
    async (change) => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const { data, error: readError } = await supabase
          .from('encounters')
          .select('id, state, updated_at')
          .eq('campaign_id', campaignId)
        if (readError) throw readError
        const current = data[0] || null
        const base = current ? normalizeEncounter(current.state) : emptyEncounter()
        const next = change(base)
        if (next === base) return
        const payload = { state: next, updated_at: new Date().toISOString() }
        if (!current) {
          const { error: insertError } = await supabase.from('encounters').insert({ campaign_id: campaignId, ...payload })
          if (!insertError) return
          if (!/duplicate|unique/i.test(insertError.message)) throw insertError
          continue // someone else created it first: go again on theirs
        }
        const { data: saved, error: updateError } = await supabase
          .from('encounters')
          .update(payload)
          .eq('id', current.id)
          .eq('updated_at', current.updated_at)
          .select('id')
        if (updateError) throw updateError
        if (saved?.length) return
      }
      throw new Error('The encounter kept changing under us — try again.')
    },
    [campaignId],
  )

  // Offline: queue the whole new state (lib/offline.js sends it later).
  const writeQueued = useCallback(
    async (next) => {
      const payload = { state: next, updated_at: new Date().toISOString() }
      if (rowIdRef.current) await updateItem(rowIdRef.current, payload)
      else rowIdRef.current = (await addItem(payload)).id
    },
    [addItem, updateItem],
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
        .then(async () => {
          try {
            await writeChange(change)
          } catch (err) {
            if (!isNetworkError(err)) throw err
            await writeQueued(next)
          }
          await refetch({ silent: true })
          notifyTableChanged('encounters')
        })
        .then(() => setSaveError(null))
        .catch((err) => setSaveError(err.message))
        // Show the saved row again once nothing newer is waiting.
        .finally(() => setPending((p) => (p === next ? null : p)))
    },
    [shared, writeChange, writeQueued, refetch],
  )

  return { state, update, shared, loading: shared && loading, error: saveError }
}
