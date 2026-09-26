import { useId, useMemo, useState } from 'react'
import { useCampaignData } from '../hooks/useCampaignData.js'
import { searchEntities } from '../lib/search.js'
import { RELATION_SUGGESTIONS } from '../lib/relations.js'
import { EntityChip } from './ui.jsx'
import './LinkPicker.scss'

const MAX_OPTIONS = 8

// Pick one existing campaign entry (by typing to search) plus an optional
// relation label. `value` is { type, id } or null. `exclude` hides an
// entry (e.g. the one being linked from).
function LinkPicker({ label = 'Link to', value, onChange, relation, onRelationChange, exclude, showRelation = true }) {
  const { entities, getEntity } = useCampaignData()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const uid = useId()

  const options = useMemo(() => {
    if (!query.trim()) return []
    return searchEntities(entities, query)
      .filter((e) => !(exclude && e.type === exclude.type && e.id === exclude.id))
      .slice(0, MAX_OPTIONS)
  }, [entities, query, exclude])

  const selected = value ? getEntity(value.type, value.id) : null

  return (
    <div className="link-picker">
      <span className="link-picker__label" id={`${uid}-label`}>
        {label}
      </span>
      {value ? (
        <div className="link-picker__selected">
          <EntityChip entity={selected} />
          <button type="button" className="btn btn--text" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      ) : (
        <div className="link-picker__search">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type to find an NPC, place, quest…"
            aria-labelledby={`${uid}-label`}
            aria-expanded={open && options.length > 0}
            aria-controls={`${uid}-options`}
            role="combobox"
            aria-autocomplete="list"
          />
          {open && options.length > 0 && (
            <ul className="link-picker__options" id={`${uid}-options`} role="listbox">
              {options.map((entity) => (
                <li key={`${entity.type}-${entity.id}`} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ type: entity.type, id: entity.id })
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    <span aria-hidden="true">{entity.icon}</span> {entity.title || 'Untitled'}
                    <span className="link-picker__type">{entity.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() && options.length === 0 && (
            <p className="field-hint">No entries match “{query.trim()}”.</p>
          )}
        </div>
      )}
      {value && showRelation && onRelationChange && (
        <div className="field">
          <label htmlFor={`${uid}-relation`}>How are they related? (optional)</label>
          <input
            id={`${uid}-relation`}
            type="text"
            list={`${uid}-relations`}
            value={relation}
            onChange={(e) => onRelationChange(e.target.value)}
            placeholder="e.g. encountered at"
          />
          <datalist id={`${uid}-relations`}>
            {RELATION_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  )
}

export default LinkPicker
