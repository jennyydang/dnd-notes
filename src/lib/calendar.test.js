import { describe, expect, it } from 'vitest'
import { advanceDays, daysLeft, deadline, dueDayFromForm, dueDayFromNow, stepLabel } from './calendar.js'

describe('calendar', () => {
  const now = new Date('2026-10-18T12:00:00Z')

  it('moves the day on and logs why', () => {
    expect(advanceDays(null, 1, 'Long rest', now)).toEqual({ day: 2, log: [{ from: 1, to: 2, note: 'Long rest', at: now.toISOString() }] })
    const next = advanceDays({ day: 10, log: [{ from: 9, to: 10 }] }, 4, ' Kingsroad ', now)
    expect(next.day).toBe(14)
    expect(next.log.at(-1)).toMatchObject({ from: 10, to: 14, note: 'Kingsroad' })
  })

  it('can go back to fix a mistake, but never before day 1', () => {
    expect(advanceDays({ day: 5 }, -2).day).toBe(3)
    expect(advanceDays({ day: 2 }, -9).day).toBe(1)
    expect(advanceDays({ day: 1 }, -1)).toBeNull()
    expect(advanceDays({ day: 4 }, 0)).toBeNull()
  })

  it('turns "due in N days" into a due day', () => {
    expect(dueDayFromNow(10, 4)).toBe(14)
    expect(dueDayFromNow(10, '')).toBeNull()
    expect(daysLeft(14, 12)).toBe(2)
    expect(daysLeft(null, 12)).toBeNull()
  })

  it('keeps an untouched deadline as it was, even when overdue', () => {
    expect(dueDayFromForm('0', '0', 15, 20)).toBe(15)
    expect(dueDayFromForm('2', '0', 15, 20)).toBe(22)
    expect(dueDayFromForm('', '0', 15, 20)).toBeNull()
    expect(dueDayFromForm('3', '', null, 20)).toBe(23)
  })

  it('words a deadline', () => {
    expect(deadline(20, 10)).toMatchObject({ text: '10 days left', tone: 'ok' })
    expect(deadline(13, 10)).toMatchObject({ text: '3 days left', tone: 'soon' })
    expect(deadline(11, 10)).toMatchObject({ text: 'Due tomorrow', tone: 'soon' })
    expect(deadline(10, 10)).toMatchObject({ text: 'Due today', tone: 'due' })
    expect(deadline(9, 10)).toMatchObject({ text: 'Overdue by 1 day', tone: 'overdue' })
    expect(deadline(null, 10)).toBeNull()
  })

  it('labels a step', () => {
    expect(stepLabel({ from: 3, to: 7 })).toBe('+4 days')
    expect(stepLabel({ from: 3, to: 2 })).toBe('−1 day')
  })
})
