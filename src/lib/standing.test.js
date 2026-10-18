import { describe, expect, it } from 'vitest'
import { STANDINGS, isFaction, standingChange, standingChangeLabel, standingDirection, standingInfo } from './standing.js'

describe('standing', () => {
  it('runs from Hated (−3) to Revered (+3)', () => {
    expect(STANDINGS.map((s) => s.value)).toEqual([-3, -2, -1, 0, 1, 2, 3])
    expect(standingInfo(0).id).toBe('Neutral')
    expect(standingInfo(null)).toBeNull()
  })

  it('knows a faction by its category', () => {
    expect(isFaction({ category: 'Faction' })).toBe(true)
    expect(isFaction({ category: ' factions ' })).toBe(true)
    expect(isFaction({ category: 'Religion' })).toBe(false)
    expect(isFaction({})).toBe(false)
  })

  it('logs each change with its reason', () => {
    const now = new Date('2026-10-18T12:00:00Z')
    const first = standingChange({ standing: null, standingLog: [] }, 0, ' met them ', now)
    expect(first).toEqual({ standing: 0, standing_log: [{ from: null, to: 0, note: 'met them', at: now.toISOString() }] })
    const next = standingChange({ standing: 0, standingLog: first.standing_log }, -2, 'burned the warehouse', now)
    expect(next.standing_log).toHaveLength(2)
    expect(standingChange({ standing: 1 }, 1)).toBeNull()
  })

  it('describes a change', () => {
    expect(standingChangeLabel({ from: null, to: 2 })).toBe('→ Trusted')
    expect(standingChangeLabel({ from: 0, to: -1 })).toBe('Neutral → Unfriendly')
    expect(standingDirection({ from: 0, to: -1 })).toBe('down')
    expect(standingDirection({ from: -1, to: 1 })).toBe('up')
    expect(standingDirection({ from: null, to: 1 })).toBe('set')
  })
})
