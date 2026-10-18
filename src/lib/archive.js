// Archiving a DM item once it's been revealed: it leaves the DM's active
// list (players' copies stay). archived_at null = active.
export const archivePatch = (archived) => ({ archived_at: archived ? new Date().toISOString() : null })

export function archiveError(archived, name, err) {
  const hint = /archived_at/.test(err.message) ? ' — run the latest supabase/schema.sql to add archiving.' : ''
  return `Couldn’t ${archived ? 'archive' : 'unarchive'} ${name}: ${err.message}${hint}`
}
