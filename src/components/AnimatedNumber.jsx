import { useEffect, useRef, useState } from 'react'
import './AnimatedNumber.scss'

const DURATION_MS = 600
const FLASH_MS = 900

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const easeOut = (t) => 1 - (1 - t) ** 3

// A number that counts up or down to its new value instead of snapping,
// and flashes green (up) or red (down) as it does — HP, gold, how many
// potions are left. `format` turns the in-between values into text.
// `invert` swaps the colours where going down is the good news.
function AnimatedNumber({ value, format = (n) => Math.round(n), invert = false, className = '' }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(target)
  const [direction, setDirection] = useState(null) // 'up' | 'down' | null
  const fromRef = useRef(target)
  const frameRef = useRef(null)
  const flashTimer = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return undefined
    fromRef.current = target
    setDirection(target > from ? 'up' : 'down')
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setDirection(null), FLASH_MS)

    if (reducedMotion()) {
      setShown(target)
      return undefined
    }
    const start = performance.now()
    const startValue = from
    cancelAnimationFrame(frameRef.current)
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setShown(startValue + (target - startValue) * easeOut(t))
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const good = direction && (direction === 'up') !== invert
  return (
    <span className={`animated-number${direction ? ` animated-number--${good ? 'good' : 'bad'}` : ''} ${className}`}>
      {format(shown)}
    </span>
  )
}

export default AnimatedNumber
