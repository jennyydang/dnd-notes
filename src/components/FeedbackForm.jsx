import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import './FeedbackForm.scss'

const KINDS = [
  { value: 'issue', label: 'Issue' },
  { value: 'suggestion', label: 'Suggestion' },
]

// The admin screen never shows who sent feedback. If the player ticks
// "Tell me when it's solved" (on by default), their player_id is saved
// with it so the admin's Solved button can notify them; unticked, nothing
// identifies the sender. The admin (no playerId) gets no checkbox.
function FeedbackForm({ playerId, onDone }) {
  const [kind, setKind] = useState('issue')
  const [message, setMessage] = useState('')
  const [notify, setNotify] = useState(true)
  const [notifySaved, setNotifySaved] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const row = { kind, message: message.trim() }
      const wantsReply = Boolean(playerId && notify)
      let { error: insertError } = await supabase
        .from('feedback')
        .insert(wantsReply ? { ...row, player_id: playerId } : row)
      // Database not updated for replies yet: still send the feedback.
      if (insertError && wantsReply && /player_id/.test(insertError.message)) {
        ;({ error: insertError } = await supabase.from('feedback').insert(row))
        if (!insertError) setNotifySaved(false)
      } else if (!insertError) {
        setNotifySaved(wantsReply)
      }
      if (insertError) throw new Error(insertError.message)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="feedback-form panel">
        <h3>{notifySaved ? 'Sent' : 'Sent anonymously'}</h3>
        <p>
          Thanks — your {kind} has been sent to the admin.
          {notifySaved && ' You’ll get a notification in the bell when it’s solved.'}
        </p>
        <div className="feedback-form__actions">
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="feedback-form panel" onSubmit={submit}>
      <h3>Send Feedback</h3>
      <p className="feedback-form__note">The admin sees your message, not who sent it.</p>
      <div className="field">
        <label htmlFor="feedback-kind">Type</label>
        <select id="feedback-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="feedback-message">
          {kind === 'issue' ? 'What went wrong?' : 'What would you like to see?'}
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            kind === 'issue'
              ? "Something isn't working right..."
              : 'It would be great if...'
          }
          required
        />
      </div>
      {playerId && (
        <label className="feedback-form__notify">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>
            Tell me when it’s solved
            <small>Saves your account with this message so we can let you know. Untick to stay fully anonymous.</small>
          </span>
        </label>
      )}
      {error && <p className="empty-state empty-state--error">{error}</p>}
      <div className="feedback-form__actions">
        <button type="button" className="btn btn--text" onClick={onDone} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

export default FeedbackForm
