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

// A session already this close to the top counts as "here", so the
// Earlier / Later buttons always move by a real step.
const NUDGE = 48

// Oldest first, so the timeline reads top (session zero) → bottom
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

  // Open scrolled to the latest session (the bottom), since that's
  // usually what the player wants to look at.
  const scrollerRef = useRef(null)
  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [columns.length])

  // Jumps to the previous / next session's header.
  function scrollSessions(direction) {
    const scroller = scrollerRef.current
    if (!scroller) return
    const top = scroller.getBoundingClientRect().top
    const offsets = [...scroller.querySelectorAll('.timeline__session')].map(
      (el) => el.getBoundingClientRect().top - top + scroller.scrollTop,
    )
    const current = scroller.scrollTop
    const target =
      direction < 0
        ? [...offsets].reverse().find((o) => o < current - NUDGE)
        : offsets.find((o) => o > current + NUDGE)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: target ?? (direction < 0 ? 0 : scroller.scrollHeight), behavior: reduce ? 'auto' : 'smooth' })
  }

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
          {columns.length > 1 && (
            <div className="timeline__nav">
              <button type="button" className="btn btn--text" onClick={() => scrollSessions(-1)} aria-label="Earlier sessions">
                ↑ Earlier
              </button>
              <button type="button" className="btn btn--text" onClick={() => scrollSessions(1)} aria-label="Later sessions">
                Later ↓
              </button>
            </div>
          )}
          <div className="timeline" ref={scrollerRef} tabIndex={0} aria-label="Timeline of sessions">
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
