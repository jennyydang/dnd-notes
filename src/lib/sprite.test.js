import { describe, expect, it } from 'vitest'
import { DEFAULT_SPRITE, H, OPTIONS, RACES, W, applyRace, randomSprite, renderSprite } from './sprite.js'

const filled = (grid) => grid.flat().filter(Boolean).length
const OUTLINE = '#1a1210'

describe('renderSprite', () => {
  it('draws every view and frame on the sprite grid', () => {
    for (const view of ['front', 'back', 'left', 'right'])
      for (const frame of [0, 1, 2]) {
        const grid = renderSprite(DEFAULT_SPRITE, view, frame)
        expect(grid).toHaveLength(H)
        expect(grid[0]).toHaveLength(W)
        expect(filled(grid)).toBeGreaterThan(150)
      }
  })
  it('left is the right view mirrored', () => {
    const right = renderSprite(DEFAULT_SPRITE, 'right')
    const left = renderSprite(DEFAULT_SPRITE, 'left')
    expect(left.map((row) => [...row].reverse())).toEqual(right)
  })
  it('outlines the whole sprite', () => {
    const grid = renderSprite(DEFAULT_SPRITE)
    // Leftmost filled pixel on each row is outline (or the floor shadow).
    for (const row of grid) {
      const first = row.find(Boolean)
      if (first) expect([OUTLINE, 'rgba(0,0,0,0.28)']).toContain(first)
    }
  })
  it('walking frames differ from standing', () => {
    expect(renderSprite(DEFAULT_SPRITE, 'front', 1)).not.toEqual(renderSprite(DEFAULT_SPRITE, 'front', 0))
  })
  it('every option draws without breaking', () => {
    for (const [key, list] of Object.entries(OPTIONS))
      for (const [value] of list) expect(filled(renderSprite({ ...DEFAULT_SPRITE, [key]: value }))).toBeGreaterThan(150)
    for (const race of Object.keys(RACES)) expect(filled(renderSprite(applyRace(DEFAULT_SPRITE, race), 'back'))).toBeGreaterThan(150)
  })
})

describe('choices', () => {
  it('races set skin and traits', () => {
    expect(applyRace(DEFAULT_SPRITE, 'tiefling')).toMatchObject({ skin: 'infernal', horns: true, eyeColor: 'amber' })
    expect(applyRace(DEFAULT_SPRITE, 'dwarf')).toMatchObject({ beard: true, horns: false })
  })
  it('randomize gives a complete sprite', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const sprite = randomSprite(rand)
    for (const key of Object.keys(DEFAULT_SPRITE)) expect(sprite).toHaveProperty(key)
  })
})
