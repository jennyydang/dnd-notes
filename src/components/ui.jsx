import { useState } from 'react'
import Icon from './Icon.jsx'

// Small shared building blocks used across Home, Session Mode, Character
// and Prep, so those screens share one look (styles in styles/_shared.scss).

// A password field with a Show/Hide toggle, so people can check what
// they typed (especially on phones). Other props go to the <input>.
export function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`password-input ${className}`}>
      <input {...props} type={visible ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={props.id}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function SectionCard({ title, icon, action, className = '', children, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  return (
    <section className={`section-card panel ${className}`}>
      {(title || action) && (
        <header className="section-card__header">
          {title && (
            <Heading className="section-card__title">
              {icon && (
                <span aria-hidden="true" className="section-card__icon">
                  <Icon name={icon} />
                </span>
              )}
              {title}
            </Heading>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatusMessage({ loading, error, empty, children }) {
  if (loading) return <p className="inline-state">Loading…</p>
  if (error) return <p className="inline-state inline-state--error" role="alert">{error}</p>
  if (empty) return <p className="inline-state">{children}</p>
  return null
}

export function Chip({ active, onClick, children, label, className = '' }) {
  return (
    <button
      type="button"
      className={`chip${active ? ' chip--active' : ''} ${className}`}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
    >
      {active && (
        <span aria-hidden="true" className="chip__check">
          ✓
        </span>
      )}
      {children}
    </button>
  )
}

// −/value/+ control with large touch targets. `value` null shows a dash.
export function Stepper({ label, value, onChange, min = 0, max = Infinity, step = 1, compact }) {
  const n = value ?? 0
  return (
    <div className={`stepper${compact ? ' stepper--compact' : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.max(min, n - step))}
        disabled={n <= min}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <output key={value ?? 'blank'} className="stepper__value" aria-live="polite">
        {value ?? '—'}
      </output>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(Math.min(max, n + step))}
        disabled={n >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  )
}

const SAVE_LABELS = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Not saved',
}

export function SaveStatus({ status, error, onRetry }) {
  if (!status || status === 'idle') return null
  return (
    <p className={`save-status save-status--${status}`} role="status" aria-live="polite">
      {status === 'error' ? '! ' : status === 'saved' ? '✓ ' : ''}
      {SAVE_LABELS[status]}
      {status === 'error' && (
        <>
          {error ? `: ${error}` : ''}{' '}
          <button type="button" className="btn btn--text save-status__retry" onClick={onRetry}>
            Retry
          </button>
        </>
      )}
    </p>
  )
}

// A clickable reference to a campaign entry (or a placeholder when the
// entry it pointed at has been deleted).
export function EntityChip({ entity, missingLabel = 'Deleted entry', onOpen, suffix }) {
  if (!entity) {
    return (
      <span className="entity-chip entity-chip--missing">
        <span aria-hidden="true">!</span> {missingLabel}
        {suffix}
      </span>
    )
  }
  return (
    <span className="entity-chip">
      <button type="button" className="entity-chip__open" onClick={() => onOpen?.(entity)}>
        <Icon name={entity.icon} />
        <span className="entity-chip__title">{entity.title || 'Untitled'}</span>
        <span className="entity-chip__type">{entity.label}</span>
      </button>
      {suffix}
    </span>
  )
}

const VIEW_MODES = [
  { id: 'cards', label: 'Cards', icon: 'grid' },
  { id: 'compact', label: 'Compact', icon: 'rows' },
]

// Cards / Compact switch for a list's toolbar.
// A compact dropdown for sorting or filtering a list: "⇅ Sort  Last added ▾".
// A native <select> underneath, so phones get their own picker. When
// `onClear` is given and the filter is narrowing the list (`active`), it
// lights up and shows a × that resets it.
export function FilterSelect({ icon, label, value, options, onChange, active = false, onClear }) {
  return (
    <span className={`filter-select${active ? ' filter-select--active' : ''}`}>
      <label className="filter-select__field">
        {icon && <Icon name={icon} />}
        <span className="filter-select__label">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="filter-select__chevron" aria-hidden="true">▾</span>
      </label>
      {active && onClear && (
        <button type="button" className="filter-select__clear" onClick={onClear} aria-label={`Clear ${label.toLowerCase()} filter`}>
          <Icon name="close" />
        </button>
      )}
    </span>
  )
}

export function ViewToggle({ value, onChange, label = 'Card size' }) {
  return (
    <div className="view-toggle" role="group" aria-label={label}>
      {VIEW_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`view-toggle__btn${value === m.id ? ' view-toggle__btn--active' : ''}`}
          aria-pressed={value === m.id}
          onClick={() => onChange(m.id)}
        >
          <Icon name={m.icon} /> <span className="view-toggle__label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
