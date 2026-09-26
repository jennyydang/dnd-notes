import { describe, expect, it } from 'vitest'
import { addCombatant, emptyEncounter, nextTurn, previousTurn, removeCombatant } from '../initiative.js'

const c = (id, initiative) => ({ id, name: id, initiative })

describe('initiative tracker', () => {
  it('sorts by initiative, keeping insertion order for ties', () => {
    let s = emptyEncounter()
    s = addCombatant(s, c('goblin', 12))
    s = addCombatant(s, c('seiya', 17))
    s = addCombatant(s, c('wolf', 12))
    expect(s.combatants.map((x) => x.id)).toEqual(['seiya', 'goblin', 'wolf'])
  })

  it('advances turns and rounds', () => {
    let s = [c('a', 20), c('b', 10)].reduce(addCombatant, emptyEncounter())
    s = nextTurn(s) // start
    expect([s.turn, s.round, s.started]).toEqual([0, 1, true])
    s = nextTurn(s)
    expect([s.turn, s.round]).toEqual([1, 1])
    s = nextTurn(s)
    expect([s.turn, s.round]).toEqual([0, 2])
    s = previousTurn(s)
    expect([s.turn, s.round]).toEqual([1, 1])
  })

  it('keeps the current creature up when someone joins or leaves', () => {
    let s = [c('a', 20), c('b', 10), c('c', 5)].reduce(addCombatant, emptyEncounter())
    s = nextTurn(nextTurn(s)) // b's turn
    s = addCombatant(s, c('d', 15)) // sorts before b
    expect(s.combatants[s.turn].id).toBe('b')
    s = removeCombatant(s, 'a')
    expect(s.combatants[s.turn].id).toBe('b')
    s = removeCombatant(s, 'b')
    expect(s.combatants[s.turn].id).toBe('c')
  })
})
