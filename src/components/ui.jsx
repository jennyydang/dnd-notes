// Small shared building blocks used across Home, Session Mode, Character
// and Prep, so those screens share one look (styles in styles/_shared.scss).

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
                  {icon}
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
      <output className="stepper__value" aria-live="polite">
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
      {status === 'error' ? '⚠ ' : status === 'saved' ? '✓ ' : ''}
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
        <span aria-hidden="true">⚠</span> {missingLabel}
        {suffix}
      </span>
    )
  }
  return (
    <span className="entity-chip">
      <button type="button" className="entity-chip__open" onClick={() => onOpen?.(entity)}>
        <span aria-hidden="true">{entity.icon}</span>
        <span className="entity-chip__title">{entity.title || 'Untitled'}</span>
        <span className="entity-chip__type">{entity.label}</span>
      </button>
      {suffix}
    </span>
  )
}
