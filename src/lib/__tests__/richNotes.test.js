import { describe, expect, it } from 'vitest'
import { joinNotes, toEditorContent } from '../richNotes.js'

describe('toEditorContent', () => {
  it('turns plain text into one paragraph per line, escaping it', () => {
    expect(toEditorContent('Tall\n<sneaky>')).toBe('<p>Tall</p><p>&lt;sneaky&gt;</p>')
  })

  it('leaves formatted notes alone', () => {
    expect(toEditorContent('<p><strong>Bold</strong></p>')).toBe('<p><strong>Bold</strong></p>')
  })
})

describe('joinNotes', () => {
  it('joins plain notes with a blank line and skips empty ones', () => {
    expect(joinNotes(['Count', '', 'Tall and pale'])).toBe('Count\n\nTall and pale')
  })

  it('makes everything HTML when any part is formatted', () => {
    expect(joinNotes(['Count', '<p><em>Tall</em></p>'])).toBe('<p>Count</p><p><em>Tall</em></p>')
  })
})
