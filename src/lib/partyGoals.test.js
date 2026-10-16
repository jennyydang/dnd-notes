import { describe, expect, it } from 'vitest'
import { goalFromRow, goalProgress, nextStep, readyToComplete, sortGoals, toggleStep } from './partyGoals.js'

const g = (over) => goalFromRow({ id: 'g', title: 'Ship', status: 'Active', steps: [], ...over })

describe('party goals', () => {
  it('measures progress from steps', () => {
    const goal = g({ steps: [{ id: 'a', text: 'Gold', done: true }, { id: 'b', text: 'Wright', done: false }] })
    expect(goalProgress(goal)).toBe(0.5)
    expect(nextStep(goal).text).toBe('Wright')
    expect(readyToComplete(goal)).toBe(false)
    const done = { ...goal, steps: toggleStep(goal.steps, 'b') }
    expect(readyToComplete(done)).toBe(true)
    expect(goalProgress(g({}))).toBe(0)
    expect(goalProgress(g({ status: 'Completed' }))).toBe(1)
  })

  it('keeps active goals in order set and achieved newest first', () => {
    const { active, achieved } = sortGoals([
      g({ id: '2', created_at: '2026-02-01', steps: [{ id: 'a', done: true }] }),
      g({ id: '1', created_at: '2026-01-01', steps: [{ id: 'a', done: false }] }),
      g({ id: '3', status: 'Completed', completed_at: '2026-01-01' }),
      g({ id: '4', status: 'Completed', completed_at: '2026-03-01' }),
    ])
    expect(active.map((x) => x.id)).toEqual(['1', '2'])
    expect(achieved.map((x) => x.id)).toEqual(['4', '3'])
  })
})
