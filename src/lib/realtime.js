import { supabase, isSupabaseConfigured } from './supabaseClient.js'

// Live updates from other devices via Supabase Realtime. Many screens read
// the same table with the same filters (the campaign index and the open tab
// both load NPCs, say), so they share one channel per table + filter.
//
// Realtime can filter on a single column, so the subscription uses the
// first filter and each listener refetches with its full filters. Deletes
// can't be filtered at all; listeners check the deleted id themselves.

const MAX_IN_VALUES = 100

// The postgres_changes filter string for `filters`, '' for "whole table",
// or null when the filters can't match anything (an empty id list).
export function realtimeFilter(filters) {
  const entries = Object.entries(filters)
  if (entries.some(([, value]) => Array.isArray(value) && value.length === 0)) return null
  const scalar = entries.find(([, value]) => !Array.isArray(value))
  if (scalar) return `${scalar[0]}=eq.${scalar[1]}`
  const list = entries.find(([, value]) => value.length <= MAX_IN_VALUES)
  if (list) return `${list[0]}=in.(${list[1].join(',')})`
  return ''
}

const channels = new Map()
let nextTopic = 0

// Calls `onChange(payload)` for every insert/update matching `filters` and
// every delete on `table`. Returns an unsubscribe function.
export function subscribeToTable(table, filters, onChange) {
  const filter = realtimeFilter(filters)
  if (!isSupabaseConfigured || filter === null) return () => {}

  const key = `${table}|${filter}`
  let entry = channels.get(key)
  if (!entry) {
    const listeners = new Set()
    const dispatch = (payload) => {
      for (const listener of listeners) listener(payload)
    }
    const scoped = filter ? { filter } : {}
    const channel = supabase
      .channel(`db-${table}-${++nextTopic}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...scoped }, dispatch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, ...scoped }, dispatch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, dispatch)
      .subscribe()
    entry = { channel, listeners }
    channels.set(key, entry)
  }
  entry.listeners.add(onChange)

  return () => {
    entry.listeners.delete(onChange)
    if (entry.listeners.size === 0 && channels.get(key) === entry) {
      channels.delete(key)
      supabase.removeChannel(entry.channel)
    }
  }
}
