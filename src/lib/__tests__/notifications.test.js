import { describe, expect, it } from 'vitest'
import { feedbackSolvedNotice } from '../notifications.js'

describe('feedbackSolvedNotice', () => {
  it('words issues and suggestions differently', () => {
    expect(feedbackSolvedNotice({ kind: 'issue', message: 'Map zoom broke' }).title).toBe('The issue you reported is solved')
    expect(feedbackSolvedNotice({ kind: 'suggestion', message: 'Dice roller' }).title).toBe('Your suggestion is done')
  })

  it('quotes the feedback, tidied and trimmed to a short excerpt', () => {
    const notice = feedbackSolvedNotice({ kind: 'issue', message: '  Line one\n\nline   two  ' })
    expect(notice).toMatchObject({ kind: 'feedback_solved', body: '“Line one line two”' })
    const long = feedbackSolvedNotice({ kind: 'issue', message: 'x'.repeat(500) }).body
    expect(long.length).toBeLessThanOrEqual(162)
    expect(long.endsWith('…”')).toBe(true)
  })
})
