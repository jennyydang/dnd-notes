import { useEffect, useId, useState } from 'react'
import { newId } from '../../lib/character.js'

// Number input that stores null when cleared (so "not entered" stays
// distinct from 0) and explains out-of-range values instead of silently
// clamping them.
export function NumberField({ label, value, onChange, min = 0, max = 999, hint, className = '' }) {
  const id = useId()
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value))
  const [error, setError] = useState(null)

  // Follow changes made elsewhere (e.g. setting Max HP also fills Current
  // HP, or Session Mode spending HP) unless the box holds an invalid draft.
  useEffect(() => {
    const shown = text.trim() === '' ? null : Number(text)
    if (!error && shown !== (value ?? null)) setText(value === null || value === undefined ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(raw) {
    setText(raw)
    if (raw.trim() === '') {
      setError(null)
      onChange(null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setError('Whole numbers only.')
      return
    }
    if (n < min || n > max) {
      setError(`Between ${min} and ${max}.`)
      return
    }
    setError(null)
    onChange(n)
  }

  return (
    <div className={`field number-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        onChange={(e) => commit(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-note` : undefined}
      />
      {(error || hint) && (
        <p id={`${id}-note`} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

export function TextArea({ label, value, onChange, rows = 3, placeholder, hint }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="field--wide"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

// Editable list of objects. `fields`: [{ key, label, type?, placeholder?, options? }].
// Items get a stable id so edits and removals target the right row.
export function ListEditor({ label, items, onChange, fields, addLabel = 'Add', emptyText, newItem = {} }) {
  const baseId = useId()
  const update = (id, key, value) => onChange(items.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  const remove = (id) => onChange(items.filter((item) => item.id !== id))

  return (
    <fieldset className="list-editor">
      <legend>{label}</legend>
      {items.length === 0 && emptyText && <p className="field-hint">{emptyText}</p>}
      <ul>
        {items.map((item, index) => (
          <li key={item.id} className="list-editor__row">
            {fields.map((f) => {
              const inputId = `${baseId}-${index}-${f.key}`
              return (
                <div key={f.key} className={`field list-editor__field list-editor__field--${f.type || 'text'}`}>
                  <label htmlFor={inputId} className={index > 0 ? 'sr-only' : undefined}>
                    {f.label}
                  </label>
                  {f.type === 'checkbox' ? (
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={Boolean(item[f.key])}
                      onChange={(e) => update(item.id, f.key, e.target.checked)}
                    />
                  ) : f.type === 'select' ? (
                    <select id={inputId} value={item[f.key] ?? ''} onChange={(e) => update(item.id, f.key, e.target.value)}>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'number' ? (
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={item[f.key] ?? ''}
                      onChange={(e) => update(item.id, f.key, e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))))}
                    />
                  ) : f.type === 'textarea' ? (
                    <textarea id={inputId} rows={2} value={item[f.key] ?? ''} onChange={(e) => update(item.id, f.key, e.target.value)} placeholder={f.placeholder} />
                  ) : (
                    <input
                      id={inputId}
                      type={f.type === 'date' ? 'date' : 'text'}
                      value={item[f.key] ?? ''}
                      onChange={(e) => update(item.id, f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              )
            })}
            <button
              type="button"
              className="icon-btn list-editor__remove"
              onClick={() => remove(item.id)}
              aria-label={`Remove ${fields[0].label.toLowerCase()} ${index + 1}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--text list-editor__add" onClick={() => onChange([...items, { id: newId(), ...newItem }])}>
        + {addLabel}
      </button>
    </fieldset>
  )
}

// Editable list of plain strings (e.g. voice lines).
export function StringListEditor({ label, items, onChange, placeholder, addLabel = 'Add' }) {
  const baseId = useId()
  const [draft, setDraft] = useState('')
  return (
    <fieldset className="list-editor">
      <legend>{label}</legend>
      <ul>
        {items.map((text, index) => (
          <li key={index} className="list-editor__row">
            <div className="field list-editor__field">
              <label htmlFor={`${baseId}-${index}`} className="sr-only">
                {label} {index + 1}
              </label>
              <input
                id={`${baseId}-${index}`}
                type="text"
                value={text}
                onChange={(e) => onChange(items.map((t, i) => (i === index ? e.target.value : t)))}
              />
            </div>
            <button
              type="button"
              className="icon-btn list-editor__remove"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="list-editor__new"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onChange([...items, draft.trim()])
          setDraft('')
        }}
      >
        <label htmlFor={`${baseId}-new`} className="sr-only">
          New {label.toLowerCase()}
        </label>
        <input id={`${baseId}-new`} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
        <button type="submit" className="btn">
          {addLabel}
        </button>
      </form>
    </fieldset>
  )
}
