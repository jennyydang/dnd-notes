import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { ENTITY_TYPES, ENTITY_TYPE_ORDER } from '../lib/entities.js'
import { normalizeText, searchEntities, snippet } from '../lib/search.js'
import { Chip } from './ui.jsx'
import './GlobalSearch.scss'

const SORTS = [
  { id: 'relevance', label: 'Best match' },
  { id: 'recent', label: 'Newest' },
  { id: 'alpha', label: 'A → Z' },
]

const MAX_RESULTS = 60

// Full-screen search across every campaign entry (NPCs, places, quests,
// lore & clues, loot, sessions, quick notes, party, goals) plus the app's
// own screens. Forgiving matching lives in lib/search.js.
function GlobalSearch({ onClose }) {
  const { entities, loading, errors } = useCampaignData()
  const nav = useCampaignNav()
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState([])
  const [sort, setSort] = useState('relevance')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const results = useMemo(
    () => searchEntities(entities, query, { types, sort }).slice(0, MAX_RESULTS),
    [entities, query, types, sort],
  )

  // Screens whose name matches, so search doubles as quick navigation.
  const screenMatches = useMemo(() => {
    const q = normalizeText(query)
    if (!q || types.length) return []
    return nav.tabs.filter((tab) => normalizeText(tab.label).includes(q)).slice(0, 4)
  }, [query, types, nav.tabs])

  const counts = useMemo(() => {
    const byType = {}
    for (const r of searchEntities(entities, query)) byType[r.type] = (byType[r.type] || 0) + 1
    return byType
  }, [entities, query])

  const items = [
    ...screenMatches.map((tab) => ({ kind: 'screen', tab })),
    ...results.map((entry) => ({ kind: 'entry', entry })),
  ]
  const activeIndex = Math.min(active, Math.max(0, items.length - 1))

  function choose(item) {
    if (!item) return
    if (item.kind === 'screen') {
      nav.goTo(item.tab.id)
    } else {
      onClose()
      nav.openEntity(item.entry.type, item.entry.id)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(items[activeIndex])
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function toggleType(type) {
    setActive(0)
    setTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    )
  }

  const hasQuery = query.trim().length > 0

  return createPortal(
    <div className="global-search" role="dialog" aria-modal="true" aria-label="Search campaign" onKeyDown={onKeyDown}>
      <div className="global-search__backdrop" onClick={onClose} />
      <div className="global-search__panel panel">
        <div className="global-search__bar">
          <span aria-hidden="true">&#128269;</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Search everything in this campaign"
            aria-label="Search"
            aria-controls="global-search-results"
            aria-activedescendant={items.length ? `global-search-item-${activeIndex}` : undefined}
          />
          <button type="button" className="btn btn--text" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="global-search__filters">
          <div className="chip-row" role="group" aria-label="Filter by type">
            {ENTITY_TYPE_ORDER.map((type) => (
              <Chip key={type} active={types.includes(type)} onClick={() => toggleType(type)}>
                <span aria-hidden="true">{ENTITY_TYPES[type].icon}</span> {ENTITY_TYPES[type].plural}
                {hasQuery && <span className="global-search__count">{counts[type] || 0}</span>}
              </Chip>
            ))}
          </div>
          <label className="global-search__sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errors.length > 0 && (
          <p className="inline-state inline-state--error">
            Some entries couldn&apos;t load and won&apos;t appear: {errors.join('; ')}
          </p>
        )}

        <ul className="global-search__results" id="global-search-results" role="listbox" ref={listRef}>
          {items.map((item, index) => {
            const isActive = index === activeIndex
            const common = {
              id: `global-search-item-${index}`,
              role: 'option',
              'aria-selected': isActive,
              'data-active': isActive,
              className: `global-search__result${isActive ? ' global-search__result--active' : ''}`,
              onClick: () => choose(item),
              onMouseEnter: () => setActive(index),
            }
            if (item.kind === 'screen') {
              return (
                <li key={`screen-${item.tab.id}`} {...common}>
                  <span className="global-search__icon" aria-hidden="true">
                    {item.tab.icon}
                  </span>
                  <span className="global-search__main">
                    <span className="global-search__title">Go to {item.tab.label}</span>
                  </span>
                  <span className="global-search__type">Screen</span>
                </li>
              )
            }
            const { entry } = item
            const excerpt = hasQuery ? snippet(entry.body, query, 110) : ''
            return (
              <li key={`${entry.type}-${entry.id}`} {...common}>
                <span className="global-search__icon" aria-hidden="true">
                  {entry.icon}
                </span>
                <span className="global-search__main">
                  <span className="global-search__title">{entry.title || 'Untitled'}</span>
                  {entry.subtitle && <span className="global-search__subtitle">{entry.subtitle}</span>}
                  {excerpt && <span className="global-search__excerpt">{excerpt}</span>}
                </span>
                <span className="global-search__type">{entry.label}</span>
              </li>
            )
          })}
        </ul>

        {loading && !entities.length && <p className="inline-state">Loading campaign…</p>}

        {!loading && items.length === 0 && (
          <div className="global-search__empty">
            {hasQuery ? (
              <>
                <p>
                  Nothing matches <strong>“{query.trim()}”</strong>
                  {types.length ? ' in the selected types' : ''}.
                </p>
                <p className="field-hint">
                  Try fewer or shorter words{types.length ? ', or clear the type filters' : ''}.
                </p>
                <div className="form-actions">
                  {types.length > 0 && (
                    <button type="button" className="btn btn--text" onClick={() => setTypes([])}>
                      Clear filters
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      onClose()
                      nav.openQuickCreate('npc', { name: query.trim() })
                    }}
                  >
                    + Create “{query.trim()}”
                  </button>
                </div>
              </>
            ) : (
              <p>No entries yet. Add NPCs, places and quests from Home or Session Mode.</p>
            )}
          </div>
        )}
        <p className="global-search__hint field-hint">
          ↑ ↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>,
    document.body,
  )
}

export default GlobalSearch
