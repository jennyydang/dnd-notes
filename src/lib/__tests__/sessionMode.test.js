import { describe, expect, it } from 'vitest'
import { quickNotesToRecapHtml, todayIso } from '../sessionMode.js'

describe('quickNotesToRecapHtml', () => {
  it('lists notes oldest first and escapes HTML', () => {
    const html = quickNotesToRecapHtml([
      { content: 'Second <b>', createdAt: '2026-01-01T20:10:00' },
      { content: 'First', createdAt: '2026-01-01T19:00:00' },
    ])
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'))
    expect(html).toContain('Second &lt;b&gt;')
    expect(html.startsWith('<ul><li><p><strong>')).toBe(true)
  })
  it('is empty with no notes', () => {
    expect(quickNotesToRecapHtml([])).toBe('')
  })
})

describe('todayIso', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05')
  })
})
