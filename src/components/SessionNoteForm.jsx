import { formatSessionDate } from '../lib/sessionNotes.js'
import { RichNotesEditor } from './RichNotesEditor.jsx'

// The title/date/notes fields of a session recap (used by the Session
// Notes tab and the End Session recap). `idPrefix` keeps DOM ids unique if more
// than one copy is ever mounted at once.
function SessionNoteForm({
  idPrefix,
  campaignId,
  form,
  setForm,
  onSubmit,
  formError,
  submitLabel,
  submitting = false,
  onCancel,
  // Editing an existing session: shows Delete on the left of the buttons.
  onDelete,
  // Extra section above the buttons (the edit dialog's recording).
  children,
}) {
  return (
    <form className="session-form panel" onSubmit={onSubmit}>
      <div className="session-form__grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-title`}>Title</label>
          <input
            id={`${idPrefix}-title`}
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Session 12: The Siege of Waterdeep"
            disabled={submitting}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-date`}>Date</label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={form.sessionDate}
            onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
            disabled={submitting}
          />
        </div>
      </div>
      <div className="field">
        <label id={`${idPrefix}-notes-label`}>Recap</label>
        <RichNotesEditor
          campaignId={campaignId}
          labelId={`${idPrefix}-notes-label`}
          className={`${idPrefix}-notes`}
          value={form.notes}
          onChange={(notes) => setForm((prev) => ({ ...prev, notes }))}
          // Newly tagged NPCs get "where we met them" pre-filled with
          // this session, so the player has a starting point later.
          metAt={form.title || formatSessionDate(form.sessionDate)}
          placeholder="The party arrived at the gates of Waterdeep and..."
          disabled={submitting}
        />
      </div>
      {children}
      {formError && <p className="empty-state empty-state--error">{formError}</p>}
      <div className="session-form__actions">
        {onDelete && (
          <button type="button" className="btn btn--danger form-delete" onClick={onDelete} disabled={submitting}>
            Delete
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn btn--text" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export default SessionNoteForm
