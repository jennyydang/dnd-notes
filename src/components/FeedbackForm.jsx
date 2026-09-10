import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import './FeedbackForm.scss'

const KINDS = [
  { value: 'issue', label: 'Issue' },
  { value: 'suggestion', label: 'Suggestion' },
]

// No player_id/campaign_id gets attached anywhere in this flow — the
// submission really is anonymous, not just app-enforced-private like
// session notes.
function FeedbackForm({ onDone }) {
  const [kind, setKind] = useState('issue')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: insertError } = await supabase
        .from('feedback')
        .insert({ kind, message: message.trim() })
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
        <h3>Sent anonymously</h3>
        <p>Thanks — your {kind} has been sent to the admin.</p>
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
      <p className="feedback-form__note">
        Anonymous — the admin sees your message, not who sent it.
      </p>
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
