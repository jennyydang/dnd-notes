import { Children, useCallback, useEffect, useId, useRef, useState } from 'react'
import './CardRail.scss'

// A horizontal, swipeable row of cards that snaps card-by-card. Touch and
// trackpad users swipe; everyone else gets Previous/Next buttons (hidden
// at either end) and a "2 / 7" position readout. Items stay in normal tab
// order, and focusing one scrolls it into view.
function CardRail({ label, children, className = '' }) {
  const items = Children.toArray(children)
  const railRef = useRef(null)
  const id = useId()
  const [edges, setEdges] = useState({ start: true, end: true })
  const [position, setPosition] = useState(1)

  const measure = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const maxScroll = rail.scrollWidth - rail.clientWidth
    setEdges({ start: rail.scrollLeft <= 2, end: rail.scrollLeft >= maxScroll - 2 })
    const first = rail.firstElementChild
    const step = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 0) : 1
    setPosition(Math.min(items.length, Math.round(rail.scrollLeft / step) + 1))
  }, [items.length])

  useEffect(() => {
    measure()
    const rail = railRef.current
    if (!rail) return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [measure])

  function scrollByCard(direction) {
    const rail = railRef.current
    const first = rail?.firstElementChild
    if (!rail || !first) return
    rail.scrollBy({ left: direction * (first.getBoundingClientRect().width + 12), behavior: 'smooth' })
  }

  const overflowing = !(edges.start && edges.end)

  return (
    <div className={`card-rail ${className}`}>
      <ul className="card-rail__track" ref={railRef} onScroll={measure} aria-label={label} id={id}>
        {items.map((child, index) => (
          <li className="card-rail__item" key={child.key ?? index}>
            {child}
          </li>
        ))}
      </ul>
      {overflowing && (
        <div className="card-rail__controls">
          <button
            type="button"
            className="card-rail__btn"
            onClick={() => scrollByCard(-1)}
            disabled={edges.start}
            aria-controls={id}
            aria-label={`Previous in ${label}`}
          >
            ‹
          </button>
          <span className="card-rail__position" aria-live="polite">
            {position} / {items.length}
          </span>
          <button
            type="button"
            className="card-rail__btn"
            onClick={() => scrollByCard(1)}
            disabled={edges.end}
            aria-controls={id}
            aria-label={`Next in ${label}`}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

export default CardRail
