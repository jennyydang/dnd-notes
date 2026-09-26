// Pure state transitions for the Session Mode initiative tracker. State:
// { combatants: [{ id, name, initiative, hp, isPlayer, note }],
//   turn: index into the sorted list, round: 1-based, started: bool }

export const emptyEncounter = () => ({ combatants: [], turn: 0, round: 1, started: false })

// Highest initiative first; ties keep the order they were added in.
export function sortCombatants(combatants) {
  return combatants
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.initiative - a.c.initiative || a.index - b.index)
    .map(({ c }) => c)
}

export function addCombatant(state, combatant) {
  const current = state.combatants[state.turn]
  const combatants = sortCombatants([...state.combatants, combatant])
  // Keep the same creature "up" when someone joins mid-fight.
  const turn = state.started && current ? combatants.findIndex((c) => c.id === current.id) : 0
  return { ...state, combatants, turn: Math.max(0, turn) }
}

export function removeCombatant(state, id) {
  const index = state.combatants.findIndex((c) => c.id === id)
  if (index === -1) return state
  const combatants = state.combatants.filter((c) => c.id !== id)
  let turn = state.turn
  if (index < turn) turn -= 1
  if (turn >= combatants.length) turn = 0
  return { ...state, combatants, turn, started: state.started && combatants.length > 0 }
}

export function updateCombatant(state, id, patch) {
  return {
    ...state,
    combatants: state.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }
}

export function nextTurn(state) {
  if (!state.combatants.length) return state
  if (!state.started) return { ...state, started: true, turn: 0, round: 1 }
  const turn = state.turn + 1
  if (turn >= state.combatants.length) return { ...state, turn: 0, round: state.round + 1 }
  return { ...state, turn }
}

export function previousTurn(state) {
  if (!state.combatants.length || !state.started) return state
  if (state.turn > 0) return { ...state, turn: state.turn - 1 }
  if (state.round > 1) return { ...state, turn: state.combatants.length - 1, round: state.round - 1 }
  return state
}
