import { describe, expect, it } from 'vitest'
import { lastSessionLoot } from './previously.js'

const sessions = [
  { id: 's2', createdAt: '2026-10-20T20:00:00Z' },
  { id: 's1', createdAt: '2026-10-13T20:00:00Z' },
]
const loot = [
  { id: 'old', title: 'Rusty key', createdAt: '2026-10-01T00:00:00Z' },
  { id: 'sword', title: 'Sunsword', createdAt: '2026-10-19T22:00:00Z' },
  { id: 'gold', title: '200 gold', createdAt: '2026-10-19T21:00:00Z' },
]

describe('lastSessionLoot', () => {
  it('uses the loot the recap tags', () => {
    const mentions = { loot: [{ id: 'old', label: 'Rusty key' }] }
    expect(lastSessionLoot(sessions, mentions, loot).map((l) => l.title)).toEqual(['Rusty key'])
  })
  it('otherwise takes what was added since the recap before it', () => {
    expect(lastSessionLoot(sessions, {}, loot).map((l) => l.title)).toEqual(['200 gold', 'Sunsword'])
  })
  it('has nothing to compare against on the first session', () => {
    expect(lastSessionLoot(sessions.slice(0, 1), {}, loot)).toEqual([])
  })
})
