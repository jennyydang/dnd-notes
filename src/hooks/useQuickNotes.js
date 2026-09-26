import { useCallback, useRef, useState } from 'react'
import { useCampaignData } from './useCampaignData.js'

const UNDO_MS = 6000

const fromRow = (r) => ({
  id: r.id,
  content: r.content,
  createdAt: r.created_at,
  sessionNoteId: r.session_note_id,
  convertedTo: r.converted_to,
})

// Quick notes for the logged-in player, newest first, with add / edit /
// delete-with-undo. Uses the campaign index's quick_notes table so Home,
// Session Mode and search all see the same list.
export function useQuickNotes() {
  const { tables, playerId } = useCampaignData()
  const table = tables.note
  const [pendingDelete, setPendingDelete] = useState(null)
  const timerRef = useRef(null)

  const notes = table.items
    .map(fromRow)
    .filter((n) => n.id !== pendingDelete?.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const add = useCallback(
    async (content) => {
      const text = content.trim()
      if (!text) throw new Error('Write something first.')
      if (text.length > 4000) throw new Error('Keep quick notes under 4000 characters.')
      return fromRow(await table.addItem({ content: text }))
    },
    [table],
  )

  const edit = useCallback((id, content) => table.updateItem(id, { content: content.trim() }), [table])

  const markConverted = useCallback(
    (id, target) => table.updateItem(id, { converted_to: `${target.type}:${target.id}` }),
    [table],
  )

  const attachToSession = useCallback(
    (ids, sessionNoteId) => Promise.all(ids.map((id) => table.updateItem(id, { session_note_id: sessionNoteId }))),
    [table],
  )

  // Deleting hides the note straight away and only removes it for real
  // after a few seconds, so an accidental tap can be undone.
  const remove = useCallback(
    (note) => {
      clearTimeout(timerRef.current)
      if (pendingDelete) table.removeItem(pendingDelete.id).catch(() => {})
      setPendingDelete(note)
      timerRef.current = setTimeout(() => {
        table.removeItem(note.id).catch(() => {})
        setPendingDelete(null)
      }, UNDO_MS)
    },
    [table, pendingDelete],
  )

  const undoRemove = useCallback(() => {
    clearTimeout(timerRef.current)
    setPendingDelete(null)
  }, [])

  return {
    notes,
    loading: table.loading,
    error: table.error,
    enabled: Boolean(playerId),
    add,
    edit,
    remove,
    undoRemove,
    pendingDelete,
    markConverted,
    attachToSession,
  }
}
