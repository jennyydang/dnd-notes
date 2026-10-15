import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import './TabNav.scss'

function TabNav({ tabs, activeTab, onSelect, onAddTab, className, vertical = false, label = 'Campaign sections' }) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  // When the bar is wider than the screen (it scrolls sideways on
  // phones), which ends still have tabs hidden past them.
  const navRef = useRef(null)
  const [more, setMore] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const nav = navRef.current
    if (!nav || vertical) return
    const left = nav.scrollLeft > 4
    const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }))
  }, [vertical])

  // Keep the selected tab in view. `center` (after picking a tab) glides
  // it to the middle of the bar; otherwise it's only nudged in from
  // behind an end, clear of the ‹ › buttons.
  const showActive = useCallback(
    (center = false) => {
      const nav = navRef.current
      const active = nav?.querySelector('.tab-nav__item--active')
      if (!nav || !active || vertical || nav.scrollWidth <= nav.clientWidth) return
      const navBox = nav.getBoundingClientRect()
      const box = active.getBoundingClientRect()
      const pad = 44
      let delta = 0
      if (center) delta = box.left + box.width / 2 - (navBox.left + navBox.width / 2)
      else if (box.left < navBox.left + pad) delta = box.left - (navBox.left + pad)
      else if (box.right > navBox.right - pad) delta = box.right - (navBox.right - pad)
      if (Math.abs(delta) < 2) return
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      nav.scrollTo({ left: nav.scrollLeft + delta, behavior: center && !reduce ? 'smooth' : 'auto' })
    },
    [vertical],
  )

  useEffect(() => {
    const nav = navRef.current
    if (!nav || vertical) return undefined
    measure()
    nav.addEventListener('scroll', measure, { passive: true })
    // The tabs change width when the fonts finish loading or the screen
    // turns — re-check then too.
    const observer = new ResizeObserver(() => {
      showActive()
      measure()
    })
    observer.observe(nav)
    const list = nav.querySelector('.tab-nav__list')
    if (list) observer.observe(list)
    return () => {
      nav.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, showActive, vertical, tabs.length])

  // Opening: just make sure it's visible. Picking another tab: centre it.
  const firstRun = useRef(true)
  useEffect(() => {
    showActive(!firstRun.current)
    firstRun.current = false
  }, [activeTab, showActive, tabs.length])

  function scrollBy(direction) {
    const nav = navRef.current
    if (!nav) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    nav.scrollBy({ left: direction * nav.clientWidth * 0.6, behavior: reduce ? 'auto' : 'smooth' })
  }

  function startAdding() {
    setName('')
    setIsPrivate(false)
    setIsAdding(true)
  }

  function submitAdd(event) {
    event.preventDefault()
    if (!name.trim()) return
    onAddTab(name, isPrivate)
    setIsAdding(false)
    setName('')
    setIsPrivate(false)
  }

  return (
    <nav
      ref={navRef}
      className={`tab-nav${className ? ` ${className}` : ''}${more.left ? ' tab-nav--more-left' : ''}${more.right ? ' tab-nav--more-right' : ''}`}
    >
      {more.left && (
        <button type="button" className="tab-nav__more tab-nav__more--left" onClick={() => scrollBy(-1)} aria-label="Show earlier tabs">
          <Icon name="prev" />
        </button>
      )}
      <div
        className="tab-nav__list"
        role="tablist"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-nav__item${activeTab === tab.id ? ' tab-nav__item--active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.icon && (
              <span className="tab-nav__icon" aria-hidden="true">
                <Icon name={tab.icon} />
              </span>
            )}
            {tab.label}
          </button>
        ))}
      </div>
      {more.right && (
        <button type="button" className="tab-nav__more tab-nav__more--right" onClick={() => scrollBy(1)} aria-label="Show more tabs">
          <Icon name="next" />
        </button>
      )}

      {onAddTab &&
        (isAdding ? (
          <form className="tab-nav__add-form" onSubmit={submitAdd}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tab name"
              aria-label="New tab name"
              autoFocus
            />
            <label className="tab-nav__add-private">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private
            </label>
            <button type="submit" className="btn btn--primary">
              Add
            </button>
            <button
              type="button"
              className="btn btn--text"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="tab-nav__add"
            onClick={startAdding}
            aria-label="Add a new tab"
          >
            +
          </button>
        ))}
    </nav>
  )
}

export default TabNav
