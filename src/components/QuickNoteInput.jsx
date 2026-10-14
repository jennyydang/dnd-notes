import { useState } from 'react'
import { getStored, setStored } from '../lib/sessionMode.js'

const draftKey = 'dnd-notes-quick-note-draft'

// One-line (auto-growing) capture box: Enter saves, Shift+Enter adds a
// line. The unsent draft is kept in localStorage so a refresh or tab
// switch mid-thought doesn't lose it.
function QuickNoteInput({ onAdd, placeholder = 'Jot a quick note…', autoFocus }) {
  const [text, setText] = useState(() => getStored(draftKey, ''))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function change(value) {
    setText(value)
    setStored(draftKey, value || null)
    if (error) setError(null)
  }

  async function submit(event) {
    event?.preventDefault()
    if (saving) return
    if (!text.trim()) {
      setError('Write something first.')
      return
    }
    setSaving(true)
    try {
      await onAdd(text)
      change('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="quick-note-input" onSubmit={submit}>
      <label htmlFor="quick-note-text" className="sr-only">
        Quick note
      </label>
      <textarea
        id="quick-note-text"
        value={text}
        rows={Math.min(5, Math.max(1, text.split('\n').length))}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
        }}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'quick-note-error' : undefined}
        autoFocus={autoFocus}
      />
      <button type="submit" className="btn btn--primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {error && (
        <p className="field-error quick-note-input__error" id="quick-note-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export default QuickNoteInput
