import { describe, expect, it } from 'vitest'
import {
  addCombatant,
  addCondition,
  emptyEncounter,
  nextTurn,
  normalizeEncounter,
  previousTurn,
  removeCombatant,
  removeCondition,
  turnInfo,
} from '../initiative.js'

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

describe('conditions and turn info', () => {
  const two = () => [{ ...c('a', 20), conditions: [] }, { ...c('b', 10), conditions: [] }].reduce(addCombatant, emptyEncounter())

  it('counts timed conditions down at the start of that combatant’s turn', () => {
    let s = addCondition(nextTurn(two()), 'b', { id: 'p', name: 'Poisoned', rounds: 2 })
    s = nextTurn(s) // b's turn starts: 2 → 1
    expect(s.combatants.find((x) => x.id === 'b').conditions[0].rounds).toBe(1)
    expect(s.expired).toEqual([])
    s = nextTurn(s) // a
    s = nextTurn(s) // b again: 1 → expires
    expect(s.combatants.find((x) => x.id === 'b').conditions).toEqual([])
    expect(s.expired).toEqual([{ combatant: 'b', condition: 'Poisoned' }])
  })

  it('keeps untimed conditions, and doesn’t tick when combat starts', () => {
    let s = addCondition(two(), 'a', { id: 'x', name: 'Concentrating', rounds: null })
    s = addCondition(s, 'a', { id: 'y', name: 'Blessed', rounds: 1 })
    s = nextTurn(s) // start: a's turn, nothing elapsed
    expect(s.combatants[0].conditions).toHaveLength(2)
    s = nextTurn(nextTurn(s)) // b, then a in round 2
    expect(s.combatants[0].conditions.map((x) => x.name)).toEqual(['Concentrating'])
    s = removeCondition(s, 'a', 'x')
    expect(s.combatants[0].conditions).toEqual([])
  })

  it('reports who is up and who is next, wrapping around', () => {
    let s = two()
    expect(turnInfo(s)).toEqual({ current: null, next: null })
    s = nextTurn(s)
    expect([turnInfo(s).current.id, turnInfo(s).next.id]).toEqual(['a', 'b'])
    s = nextTurn(s)
    expect([turnInfo(s).current.id, turnInfo(s).next.id]).toEqual(['b', 'a'])
  })

  it('normalizes old or missing saved state', () => {
    expect(normalizeEncounter(null)).toEqual(emptyEncounter())
    const old = normalizeEncounter({ combatants: [c('a', 1)], turn: 0, round: 1, started: false })
    expect(old.combatants[0].conditions).toEqual([])
    expect(old.expired).toEqual([])
  })
})
