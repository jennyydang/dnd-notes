import { useEffect, useMemo, useRef } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { extractMentions } from '../lib/richNotes.js'
import { formatSessionDate, sessionDateTimestamp } from '../lib/sessionNotes.js'
import './TimelineTab.scss'

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  sessionDate: r.session_date,
  notes: r.notes,
  createdAt: r.created_at,
})

// Oldest first, so the timeline reads left (session zero) → right
// (latest). Sessions sharing a date — or with no date — fall back to
// the order they were written in.
function sortOldestFirst(sessions) {
  return [...sessions].sort(
    (a, b) =>
      sessionDateTimestamp(a.sessionDate) - sessionDateTimestamp(b.sessionDate) ||
      new Date(a.createdAt) - new Date(b.createdAt),
  )
}

// Every "!event" chip from the session recaps, laid out per session.
// Nothing is stored separately: events are read out of the notes, so
// the timeline always matches them. Uses the same scoping as the Session
// Notes tab — a player sees their own notes, the admin sees everyone's.
function TimelineTab({ campaignId, playerId }) {
  const filters = playerId
    ? { campaign_id: campaignId, player_id: playerId }
    : { campaign_id: campaignId }
  const { items: sessions, loading, error } = useSupabaseTable('session_notes', {
    fromRow,
    filters,
  })

  const columns = useMemo(
    () =>
      sortOldestFirst(sessions).map((session) => ({
        ...session,
        events: extractMentions(session.notes).event,
      })),
    [sessions],
  )
  const eventCount = columns.reduce((total, column) => total + column.events.length, 0)

  // Open scrolled to the latest session (far right), since that's
  // usually what the player wants to look at.
  const scrollerRef = useRef(null)
  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollLeft = scroller.scrollWidth
  }, [columns.length])

  return (
    <section className="timeline-tab">
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="empty-state empty-state--error">{error}</p>}

      {!loading && !error && columns.length === 0 && (
        <p className="empty-state">
          No sessions yet. Write session notes and type <strong>!event</strong> followed by what
          happened to put it on the timeline.
        </p>
      )}

      {!loading && !error && columns.length > 0 && (
        <>
          {eventCount === 0 && (
            <p className="empty-state">
              No events yet. In a session recap, type <strong>!event</strong> followed by what
              happened — e.g. <em>!event The dragon burns the mill</em>.
            </p>
          )}
          <div className="timeline" ref={scrollerRef}>
            <ol className="timeline__track">
              {columns.map((session, index) => (
                <li
                  className={`timeline__session${session.events.length === 0 ? ' timeline__session--empty' : ''}`}
                  key={session.id}
                >
                  <div className="timeline__marker" aria-hidden="true" />
                  <header className="timeline__header">
                    <span className="timeline__number">Session {index}</span>
                    <h3 className="timeline__title">{session.title || 'Untitled Session'}</h3>
                    {session.sessionDate && (
                      <span className="timeline__date">{formatSessionDate(session.sessionDate)}</span>
                    )}
                  </header>
                  {session.events.length > 0 ? (
                    <ul className="timeline__events">
                      {session.events.map((event) => (
                        <li className="timeline__event panel" key={event.id}>
                          {event.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="timeline__none">No events</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </section>
  )
}

export default TimelineTab
