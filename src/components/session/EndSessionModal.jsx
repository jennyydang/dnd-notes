import { useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import { quickNotesToRecapHtml, todayIso } from '../../lib/sessionMode.js'
import Modal from '../Modal.jsx'
import SessionNoteForm from '../SessionNoteForm.jsx'
import { useSessionRecorder } from '../../hooks/useSessionRecorder.js'
import { attachRecording, discardRecording, formatDuration, stopRecording } from '../../lib/sessionRecorder.js'
import Icon from '../Icon.jsx'

// Ends the live session. The session's quick notes are pre-filled into a
// recap (as a timestamped bullet list) so nothing is retyped; the player
// can edit before saving, or end without writing a recap.
function EndSessionModal({ notes, onEnded, onClose }) {
  const { campaignId, tables } = useCampaignData()
  const [form, setForm] = useState(() => ({
    title: '',
    sessionDate: todayIso(),
    notes: quickNotesToRecapHtml(notes),
  }))
  const [formError, setFormError] = useState(null)
  // This session's recording (not one made for an older recap).
  const rec = useSessionRecorder()
  const hasRecording = !rec.target && (rec.status === 'recording' || rec.status === 'paused' || Boolean(rec.pending))
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    if (!form.notes.trim()) {
      setFormError('Write something in the recap first — or end without a recap.')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await tables.session.addItem({
        title: form.title,
        session_date: form.sessionDate,
        notes: form.notes,
      })
      await Promise.all(notes.map((n) => tables.note.updateItem(n.id, { session_note_id: created.id })))
      if (hasRecording) {
        await stopRecording()
        try {
          await attachRecording(created.id)
        } catch (err) {
          // The recap is saved; the recording bar shows the upload error.
          console.warn('Recording not attached:', err.message)
        }
      }
      onEnded(created)
    } catch (err) {
      setFormError(err.message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} label="End session">
      <div className="form-stack">
        <h3 className="section-card__title">End session</h3>
        <p className="field-hint">
          {notes.length
            ? `Your ${notes.length} quick note${notes.length === 1 ? ' is' : 's are'} already in the recap below — tidy it up and save.`
            : 'No quick notes this session. Write a short recap, or end without one.'}
        </p>
        {hasRecording && (
          <p className="field-hint">
            <Icon name="mic" /> Your recording ({formatDuration(rec.pending ? rec.pending.seconds : rec.seconds)}) is saved
            with this recap.
          </p>
        )}
        <SessionNoteForm
          idPrefix="end-session"
          campaignId={campaignId}
          form={form}
          setForm={setForm}
          onSubmit={submit}
          formError={formError}
          submitting={submitting}
          submitLabel={submitting ? 'Saving…' : 'Save recap & end'}
          onCancel={onClose}
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--text"
            onClick={() => {
              const lose = hasRecording ? ' The recording will be discarded — it needs a recap to be saved with.' : ''
              if ((!notes.length && !hasRecording) || window.confirm(`End without a recap? Your quick notes stay saved.${lose}`)) {
                if (hasRecording) discardRecording()
                onEnded(null)
              }
            }}
          >
            End without recap
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default EndSessionModal
