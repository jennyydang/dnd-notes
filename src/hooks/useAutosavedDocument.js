import { useCallback, useEffect, useRef, useState } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'

const SAVE_DELAY_MS = 600
const identity = (row) => row
const NEVER_MATCHES = '00000000-0000-0000-0000-000000000000'

// One autosaved row, identified by `filters` (which are also written on
// insert), exposed as a local document. Edits apply to local state at once
// and are written shortly after the last change. Saves never overlap: a
// change made while one is in flight is written as soon as it lands, so
// rapid input can't create two rows or save out of order. A pending save
// is flushed on unmount, and the browser warns before closing with
// unsaved changes. Mount with a `key` per document so switching documents
// starts fresh.
//
// - `enabled`: false → no document (the query is pointed at nothing).
// - `fromRow(row | null)` → the document; `toPayload(doc)` → columns to save.
export function useAutosavedDocument({ table, filters, enabled = true, fromRow, toPayload }) {
  const safeFilters = enabled
    ? filters
    : Object.fromEntries(Object.keys(filters).map((key) => [key, NEVER_MATCHES]))
  const { items, loading, error, addItem, updateItem } = useSupabaseTable(table, {
    fromRow: identity,
    filters: safeFilters,
  })
  const row = enabled ? items[0] || null : null

  const [doc, setDoc] = useState(null)
  const [status, setStatus] = useState('idle') // idle | pending | saving | saved | error
  const [saveError, setSaveError] = useState(null)
  const docRef = useRef(null)
  const rowIdRef = useRef(null)
  const seededRef = useRef(false)
  const timerRef = useRef(null)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const toPayloadRef = useRef(toPayload)
  toPayloadRef.current = toPayload

  // Seed once. Later refetches (our own saves echoing back, or another
  // device) don't overwrite what's on screen mid-edit.
  useEffect(() => {
    if (!enabled || loading) return
    if (seededRef.current) {
      if (row && !rowIdRef.current) rowIdRef.current = row.id
      return
    }
    seededRef.current = true
    rowIdRef.current = row?.id || null
    const initial = fromRow(row)
    docRef.current = initial
    setDoc(initial)
    // fromRow is a pure mapping supplied by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, row])

  const save = useCallback(async () => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (!docRef.current) return
    if (savingRef.current) {
      dirtyRef.current = true
      return
    }
    savingRef.current = true
    setStatus('saving')
    try {
      do {
        dirtyRef.current = false
        const payload = toPayloadRef.current(docRef.current)
        if (rowIdRef.current) {
          await updateItem(rowIdRef.current, payload)
        } else {
          const created = await addItem(payload)
          rowIdRef.current = created.id
        }
      } while (dirtyRef.current)
      setSaveError(null)
      setStatus('saved')
    } catch (err) {
      setSaveError(err.message)
      setStatus('error')
    } finally {
      savingRef.current = false
    }
  }, [addItem, updateItem])

  const saveRef = useRef(save)
  saveRef.current = save

  // `change(doc)` returns the next document — always applied to the
  // latest state, never a stale copy.
  const update = useCallback((change) => {
    if (!docRef.current) return
    const next = change(docRef.current)
    docRef.current = next
    setDoc(next)
    setStatus('pending')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => saveRef.current(), SAVE_DELAY_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) saveRef.current()
    }
  }, [])

  useEffect(() => {
    if (status !== 'pending' && status !== 'saving') return undefined
    function warn(event) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [status])

  return {
    doc: enabled ? doc : null,
    loading: enabled && (loading || !doc),
    error,
    status,
    saveError,
    retry: save,
    update,
    exists: Boolean(row),
  }
}
