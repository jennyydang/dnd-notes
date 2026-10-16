import { describe, expect, it } from 'vitest'
import { toDoodle } from './audioDoodle.js'

describe('toDoodle', () => {
  it('boils levels down to n points, loudest at 1', () => {
    const levels = Array.from({ length: 1000 }, (_, i) => (i > 500 && i < 520 ? 0.8 : 0.05))
    const doodle = toDoodle(levels, 50)
    expect(doodle).toHaveLength(50)
    expect(Math.max(...doodle)).toBe(1)
    expect(doodle[25]).toBe(1) // the loud stretch
    expect(doodle[0]).toBeLessThan(0.5)
  })

  it('stretches short recordings and handles silence', () => {
    expect(toDoodle([0.2, 0.4], 8)).toHaveLength(8)
    expect(toDoodle([0, 0, 0], 4)).toBeNull()
    expect(toDoodle([], 4)).toBeNull()
  })
})
