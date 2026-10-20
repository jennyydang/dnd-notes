import { describe, expect, it } from 'vitest'
import {
  addCombatant,
  addPlayerRoll,
  describeDice,
  moveCombatant,
  rollInitiative,
  addCondition,
  callForInitiative,
  emptyEncounter,
  isFreshAlert,
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

describe('calling for initiative', () => {
  it('starts a fresh encounter in combat mode with the alert', () => {
    const s = callForInitiative({ id: 'a1', at: '2026-10-14T20:00:00Z' })
    expect(s).toMatchObject({ combatants: [], started: false, combat: true, alert: { id: 'a1' } })
    expect(emptyEncounter().combat).toBe(false)
    expect(normalizeEncounter({ combatants: [] }).alert).toBeNull()
  })

  it('shows an alert once per device, and only while it is recent', () => {
    const at = '2026-10-14T20:00:00Z'
    const t = new Date(at).getTime()
    expect(isFreshAlert({ id: 'a1', at }, [], t + 60_000)).toBe(true)
    expect(isFreshAlert({ id: 'a1', at }, ['a1'], t + 60_000)).toBe(false)
    expect(isFreshAlert({ id: 'a1', at }, [], t + 6 * 60_000)).toBe(false)
    expect(isFreshAlert(null, [], t)).toBe(false)
  })
})

describe('ordering, player rolls and dice', () => {
  const list = (s) => s.combatants.map((x) => x.id)

  it('re-sorts by score whenever someone is added, keeping the DM’s tie order', () => {
    let s = [c('a', 15), c('b', 10), c('c', 10)].reduce(addCombatant, emptyEncounter())
    s = moveCombatant(s, 'c', 1) // DM breaks the 10–10 tie: c before b
    expect(list(s)).toEqual(['a', 'c', 'b'])
    s = addCombatant(s, c('d', 12))
    expect(list(s)).toEqual(['a', 'd', 'c', 'b']) // tie order kept
    s = moveCombatant(s, 'b', 0) // a drag across scores (b above a and d)…
    s = addCombatant(s, c('e', 10)) // …is undone by the next sort; new ties go last
    expect(list(s)).toEqual(['a', 'd', 'b', 'c', 'e'])
  })

  it('keeps the current creature up when the DM moves someone', () => {
    let s = [c('a', 15), c('b', 10), c('c', 5)].reduce(addCombatant, emptyEncounter())
    s = nextTurn(nextTurn(s)) // b's turn
    s = moveCombatant(s, 'c', 0)
    expect(s.combatants[s.turn].id).toBe('b')
    expect(moveCombatant(s, 'nope', 0)).toBe(s)
  })

  it('replaces a player’s earlier roll and re-slots them', () => {
    let s = [c('ogre', 12), c('wolf', 8)].reduce(addCombatant, emptyEncounter())
    s = addPlayerRoll(s, { id: 'r1', name: 'Seiya', initiative: 10, playerId: 'p1', conditions: [] })
    expect(list(s)).toEqual(['ogre', 'r1', 'wolf'])
    s = addPlayerRoll(s, { id: 'r2', name: 'Seiya', initiative: 19, playerId: 'p1', conditions: [] })
    expect(list(s)).toEqual(['r1', 'ogre', 'wolf']) // same entry, new place
    expect(s.combatants[0].initiative).toBe(19)
  })

  it('rolls the DM’s dice with advantage, disadvantage and other sizes', () => {
    const seq = (...values) => () => values.shift()
    expect(rollInitiative({ sides: 20, mode: 'normal' }, 2, seq(0.5))).toEqual({ rolls: [11], die: 11, total: 13 })
    expect(rollInitiative({ sides: 20, mode: 'advantage' }, 0, seq(0.1, 0.9))).toMatchObject({ rolls: [3, 19], die: 19 })
    expect(rollInitiative({ sides: 20, mode: 'disadvantage' }, -1, seq(0.1, 0.9))).toMatchObject({ die: 3, total: 2 })
    expect(rollInitiative({ sides: 6, mode: 'normal' }, 0, seq(0.999)).die).toBe(6)
    expect(describeDice({ sides: 20, mode: 'advantage' })).toBe('d20 with advantage')
    expect(describeDice(null)).toBe('d20')
  })
})
