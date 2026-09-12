import { useEffect, useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { sortSessionsByDate } from '../lib/sessionNotes.js'
import SessionNoteForm from './SessionNoteForm.jsx'
import './QuickView.scss'

const emptyForm = { title: '', sessionDate: '', notes: '' }

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  sessionDate: r.session_date,
  notes: r.notes,
})

// A persistent, always-visible sticky tab (bottom-right, on every
// campaign tab, not just Session Notes) so a player can jot down or
// continue today's recap without navigating away from whatever they're
// looking at. Player-only — CampaignView only renders this when a
// playerId is present, since there's no single "current" session note
// to show on the admin's merged, no-playerId view (and querying with an
// undefined player_id filter isn't meaningful either).
function QuickView({ campaignId, playerId }) {
  const { items: sessions, addItem, updateItem, refetch } = useSupabaseTable('session_notes', {
    fromRow,
    orderBy: 'session_date',
    ascending: false,
    filters: { campaign_id: campaignId, player_id: playerId },
  })

  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState('menu')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const current = sortSessionsByDate(sessions)[0] ?? null

  // This hook instance is mounted for the lifetime of the campaign view
  // with no realtime subscription (see useSupabaseTable.js) — refetch
  // whenever the tray is opened so a note edited via the full Session
  // Notes tab isn't shown stale here.
  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) refetch()
      return !wasOpen
    })
  }

  // Seed the editor from `current` once on entering this screen, not on
  // every background refetch — otherwise a refetch mid-typing would
  // clobber what the player is writing.
  useEffect(() => {
    if (screen !== 'session-notes') return
    setForm(
      current
        ? { title: current.title, sessionDate: current.sessionDate, notes: current.notes }
        : emptyForm,
    )
    setFormError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  async function submit(event) {
    event.preventDefault()
    if (!form.notes.trim()) return

    const payload = {
      title: form.title,
      session_date: form.sessionDate,
      notes: form.notes,
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (current) {
        await updateItem(current.id, payload)
      } else {
        await addItem(payload)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="quick-view">
      {open && (
        <div className="quick-view__panel panel">
          {screen === 'menu' ? (
            <>
              <div className="quick-view__panel-header">
                <h4>Quick View</h4>
              </div>
              <button
                type="button"
                className="quick-view__option"
                onClick={() => setScreen('session-notes')}
              >
                <span aria-hidden="true">📖</span> Current Session Notes
              </button>
            </>
          ) : (
            <>
              <div className="quick-view__panel-header">
                <button type="button" className="btn btn--text" onClick={() => setScreen('menu')}>
                  &larr; Back
                </button>
              </div>
              <SessionNoteForm
                idPrefix="quick-session"
                form={form}
                setForm={setForm}
                onSubmit={submit}
                formError={formError}
                submitting={submitting}
                submitLabel={submitting ? 'Saving…' : current ? 'Save Changes' : 'Start Session Notes'}
              />
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className="quick-view__tab"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={open ? 'Close Quick View' : 'Open Quick View'}
      >
        <span aria-hidden="true">🗂️</span> Quick View
      </button>
    </div>
  )
}

export default QuickView
