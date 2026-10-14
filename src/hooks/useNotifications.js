import { useCallback } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'

const NEVER_MATCHES = '00000000-0000-0000-0000-000000000000'

const fromRow = (r) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  readAt: r.read_at,
})

// The logged-in player's notifications (newest first): feedback marked
// solved, and any other kind added later. New ones arrive live through
// useSupabaseTable's realtime subscription.
export function useNotifications(playerId) {
  const table = useSupabaseTable('notifications', {
    fromRow,
    ascending: false,
    filters: { player_id: playerId || NEVER_MATCHES },
  })
  const { items, updateItem, removeItem } = table
  const unread = items.filter((n) => !n.readAt)

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    await Promise.all(items.filter((n) => !n.readAt).map((n) => updateItem(n.id, { read_at: now }).catch(() => {})))
  }, [items, updateItem])

  return {
    items: playerId ? items : [],
    unread: playerId ? unread : [],
    error: table.error,
    markAllRead,
    dismiss: (id) => removeItem(id),
  }
}
