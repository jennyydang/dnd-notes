import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient.js', () => ({ supabase: {} }))
const t = await import('./transcribe.js')

const segments = [
  { start: 0, end: 4, text: 'We open on the road to Barovia.' },
  { start: 65, end: 70, text: 'Roll for initiative!' },
  { start: 3725, end: 3730, text: 'Strahd smiles.' },
]

describe('transcript helpers', () => {
  it('formats times as m:ss or h:mm:ss', () => {
    expect(t.clock(65)).toBe('1:05')
    expect(t.clock(3725)).toBe('1:02:05')
  })
  it('finds the line playing at a moment', () => {
    expect(t.segmentAt(segments, 0)).toBe(0)
    expect(t.segmentAt(segments, 100)).toBe(1)
    expect(t.segmentAt([], 10)).toBe(-1)
  })
  it('lists campaign names for Whisper, once each, within its prompt limit', () => {
    const prompt = t.namesPrompt(['Strahd', 'Ireena', 'Strahd', '', ...Array(200).fill('Longname').map((n, i) => n + i)])
    expect(prompt).toMatch(/^A Dungeons & Dragons session\. Names: Strahd, Ireena, /)
    expect(prompt.length).toBeLessThan(700)
  })
  it('estimates the cost from the length', () => {
    expect(t.estimateCost(3600)).toBeCloseTo(0.36)
    expect(t.estimateCost(null)).toBeNull()
  })
  it('puts bookmarks and the timed transcript in the recap prompt', () => {
    const prompt = t.recapPrompt({ title: 'Night 3', segments, marks: [{ t: 65, label: 'Ambush' }], names: ['Strahd'] })
    expect(prompt).toContain('[1:05] Roll for initiative!')
    expect(prompt).toContain('- [1:05] Ambush')
    expect(prompt).toContain('"Night 3"')
  })
  it('adds the draft after the recap, escaping it', () => {
    const html = t.appendDraftToNotes('Old plain notes', { recap: ['They met <Strahd> & fled.'], highlights: ['Ambush'] })
    expect(html).toBe(
      '<p>Old plain notes</p><h3>Recap (drafted from the recording)</h3><p>They met &lt;Strahd&gt; &amp; fled.</p><ul><li><p>Ambush</p></li></ul>',
    )
  })
})
