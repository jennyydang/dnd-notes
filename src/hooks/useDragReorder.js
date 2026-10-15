import { useRef, useState } from 'react'

// Drag-to-reorder for a list (vertical, or sideways when the list is a
// flex row), with pointer events so it works
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
        // A flex row (e.g. a phone's swipeable strip) reorders sideways.
        const css = getComputedStyle(list)
        const x = css.display.includes('flex') && css.flexDirection.startsWith('row')
        const rects = [...list.children].map((row) => row.getBoundingClientRect())
        const gap = rects.length > 1 ? (x ? rects[1].left - rects[0].right : rects[1].top - rects[0].bottom) : 0
        const size = (x ? rects[index].width : rects[index].height) + gap
        start.current = { id, from: index, to: index, at: x ? event.clientX : event.clientY, rects, x }
        setDrag({ id, from: index, to: index, offset: 0, height: size, x })
      },
      onPointerMove(event) {
        const s = start.current
        if (!s || s.id !== id) return
        const offset = (s.x ? event.clientX : event.clientY) - s.at
        const mid = (r) => (s.x ? r.left + r.width / 2 : r.top + r.height / 2)
        const centre = mid(s.rects[s.from]) + offset
        let to = 0
        s.rects.forEach((r, i) => {
          if (i !== s.from && mid(r) < centre) to += 1
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
        const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
        if (back || forward) {
          event.preventDefault()
          onMove(id, index + (back ? -1 : 1))
        }
      },
    }
  }

  // Inline style for the row at `index` while a drag is under way.
  function rowStyle(index) {
    if (!drag) return undefined
    const { from, to, offset, height, x } = drag
    const shift = (px) => (x ? `translateX(${px}px)` : `translateY(${px}px)`)
    if (index === from) {
      return { transform: shift(offset), zIndex: 2, position: 'relative', transition: 'none' }
    }
    if (from < to && index > from && index <= to) return { transform: shift(-height) }
    if (from > to && index >= to && index < from) return { transform: shift(height) }
    return { transform: shift(0) }
  }

  return { handleProps, rowStyle, draggingId: drag?.id ?? null }
}
