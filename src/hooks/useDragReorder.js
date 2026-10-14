import { useRef, useState } from 'react'

// Drag-to-reorder for a vertical list, with pointer events so it works
// with a mouse, a finger or a pen. Only the handle starts a drag; the
// handle also takes ↑/↓ for keyboard users. While dragging, the row
// follows the pointer and the rows it passes slide out of the way;
// `onMove(id, toIndex)` runs on drop.
//
//   const drag = useDragReorder(onMove)
//   <ol ref={listRef}>… <li style={drag.rowStyle(index)}>
//     <button {...drag.handleProps(id, index, listRef)} />
export function useDragReorder(onMove) {
  const [drag, setDrag] = useState(null) // { id, from, to, offset, height }
  const start = useRef(null)

  function reset() {
    start.current = null
    setDrag(null)
  }

  function handleProps(id, index, listRef) {
    return {
      onPointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        const list = listRef.current
        if (!list) return
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        const rects = [...list.children].map((row) => row.getBoundingClientRect())
        const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0
        start.current = { id, from: index, to: index, y: event.clientY, rects }
        setDrag({ id, from: index, to: index, offset: 0, height: rects[index].height + gap })
      },
      onPointerMove(event) {
        const s = start.current
        if (!s || s.id !== id) return
        const offset = event.clientY - s.y
        const own = s.rects[s.from]
        const centre = own.top + own.height / 2 + offset
        let to = 0
        s.rects.forEach((r, i) => {
          if (i !== s.from && r.top + r.height / 2 < centre) to += 1
        })
        s.to = to
        setDrag((d) => (d ? { ...d, offset, to } : d))
      },
      onPointerUp() {
        const s = start.current
        if (!s || s.id !== id) return
        const { to } = s
        reset()
        if (to !== s.from) onMove(id, to)
      },
      onPointerCancel: reset,
      onKeyDown(event) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          onMove(id, index + (event.key === 'ArrowUp' ? -1 : 1))
        }
      },
    }
  }

  // Inline style for the row at `index` while a drag is under way.
  function rowStyle(index) {
    if (!drag) return undefined
    const { from, to, offset, height } = drag
    if (index === from) {
      return { transform: `translateY(${offset}px)`, zIndex: 2, position: 'relative', transition: 'none' }
    }
    if (from < to && index > from && index <= to) return { transform: `translateY(${-height}px)` }
    if (from > to && index >= to && index < from) return { transform: `translateY(${height}px)` }
    return { transform: 'translateY(0)' }
  }

  return { handleProps, rowStyle, draggingId: drag?.id ?? null }
}
