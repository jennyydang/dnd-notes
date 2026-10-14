import { useState } from 'react'
import { getStored, setStored } from '../lib/sessionMode.js'

const draftKey = 'dnd-notes-quick-note-draft'

// One-line (auto-growing) capture box: Enter saves, Shift+Enter adds a
// line. The unsent draft is kept in localStorage so a refresh or tab
// switch mid-thought doesn't lose it.
// `idPrefix` keeps ids unique when two of these could be on screen.
function QuickNoteInput({ onAdd, placeholder = 'Jot a quick note…', autoFocus, idPrefix = 'quick-note' }) {
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
      <label htmlFor={`${idPrefix}-text`} className="sr-only">
        Quick note
      </label>
      <textarea
        id={`${idPrefix}-text`}
        value={text}
        rows={Math.min(5, Math.max(1, text.split('\n').length))}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
        }}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idPrefix}-error` : undefined}
        autoFocus={autoFocus}
      />
      <button type="submit" className="btn btn--primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {error && (
        <p className="field-error quick-note-input__error" id={`${idPrefix}-error`} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export default QuickNoteInput
