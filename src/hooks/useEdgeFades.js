import { useCallback, useEffect, useState } from 'react'

// For a row that scrolls sideways: which ends still have content hidden
// past them, so the row can fade out there (see `.edge-fade` in
// _shared.scss) instead of being cut off hard. Returns a callback ref for
// the scrolling element and the class names to put on it.
export function useEdgeFades() {
  const [node, setNode] = useState(null)
  const [more, setMore] = useState({ overflow: false, left: false, right: false })

  const measure = useCallback(() => {
    if (!node) return
    const overflow = node.scrollWidth > node.clientWidth + 1
    const left = node.scrollLeft > 4
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 4
    setMore((m) =>
      m.overflow === overflow && m.left === left && m.right === right ? m : { overflow, left, right },
    )
  }, [node])

  useEffect(() => {
    if (!node) return undefined
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of node.children) observer.observe(child)
    return () => {
      node.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [node, measure])

  // Only a row that actually scrolls gets the fade: a mask clips anything
  // past the row's box, like a card lifting on hover in a desktop grid.
  const className = more.overflow
    ? `edge-fade${more.left ? ' edge-fade--left' : ''}${more.right ? ' edge-fade--right' : ''}`
    : ''
  return [setNode, className]
}
