// The title/date/notes fields shared by the full Session Notes tab
// (SessionNotesTab.jsx, inside its Add/Edit modal) and the Quick View
// widget's compact editor (QuickView.jsx). `idPrefix` keeps the two
// instances' DOM ids apart in case both are ever mounted at once.
function SessionNoteForm({
  idPrefix,
  form,
  setForm,
  onSubmit,
  formError,
  submitLabel,
  submitting = false,
  onCancel,
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
        <label htmlFor={`${idPrefix}-notes`}>Recap</label>
        <textarea
          id={`${idPrefix}-notes`}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="The party arrived at the gates of Waterdeep and..."
          disabled={submitting}
          required
        />
      </div>
      {formError && <p className="empty-state empty-state--error">{formError}</p>}
      <div className="session-form__actions">
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
