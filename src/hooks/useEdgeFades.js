import { useCallback, useEffect, useState } from 'react'

// For a row that scrolls sideways: which ends still have content hidden
// past them, so the row can fade out there (see `.edge-fade` in
// _shared.scss) instead of being cut off hard. Returns a callback ref for
// the scrolling element and the class names to put on it.
export function useEdgeFades() {
  const [node, setNode] = useState(null)
  const [more, setMore] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    if (!node) return
    const left = node.scrollLeft > 4
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 4
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }))
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

  const className = `edge-fade${more.left ? ' edge-fade--left' : ''}${more.right ? ' edge-fade--right' : ''}`
  return [setNode, className]
}
