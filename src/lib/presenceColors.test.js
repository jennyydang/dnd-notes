import { describe, expect, it } from 'vitest'
import { PRESENCE_COLORS, assignColors } from './presenceColors.js'

const person = (i) => ({ playerId: `player-${i}`, onlineAt: `2026-10-18T10:${String(i).padStart(2, '0')}:00Z` })
const ten = Array.from({ length: 10 }, (_, i) => person(i))

describe('assignColors', () => {
  it('gives everyone present a different colour', () => {
    const colors = assignColors(ten)
    expect(new Set(colors.values()).size).toBe(10)
  })

  it('hands colours out in arrival order, whatever order the list is in', () => {
    const a = assignColors(ten)
    const b = assignColors([...ten].reverse())
    for (const p of ten) expect(b.get(p.playerId)).toBe(a.get(p.playerId))
    expect(a.get('player-0')).toBe(PRESENCE_COLORS[0])
    expect(a.get('player-2')).toBe(PRESENCE_COLORS[2])
  })

  it('keeps earlier arrivals’ colours when someone new joins', () => {
    const before = assignColors(ten.slice(0, 3))
    const after = assignColors([...ten.slice(0, 3), person(9)])
    for (const p of ten.slice(0, 3)) expect(after.get(p.playerId)).toBe(before.get(p.playerId))
  })

  it('reuses colours past ten people rather than failing', () => {
    expect(assignColors([...ten, person(10)]).size).toBe(11)
  })
})
