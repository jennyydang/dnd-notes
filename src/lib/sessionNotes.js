// Shared between SessionNotesTab.jsx (the full tab) and QuickView.jsx
// (the sticky bottom-right widget) — both need the same "what's the
// newest session note" ordering and the same date formatting.

// Dates are stored as ISO strings (YYYY-MM-DD) from the native date
// picker. Older rows may still hold free-text dates from before this
// field was a date picker — fall back to the raw value for those rather
// than showing "Invalid Date".
export function formatSessionDate(value) {
  if (!value) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// The DB orders session_date as plain text, which only sorts correctly
// when every row is the same ISO YYYY-MM-DD format. Rows predating the
// date picker can still hold free-text dates (e.g. "May 24, 2026"), and
// those sort before any ISO string in text order regardless of the
// actual date — so re-sort client-side using real parsed timestamps
// instead.
export function sessionDateTimestamp(value) {
  if (!value) return -Infinity
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value
  const parsed = new Date(isoValue)
  return Number.isNaN(parsed.getTime()) ? -Infinity : parsed.getTime()
}

export function sortSessionsByDate(sessions) {
  return [...sessions].sort(
    (a, b) => sessionDateTimestamp(b.sessionDate) - sessionDateTimestamp(a.sessionDate),
  )
}
