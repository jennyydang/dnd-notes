// Pure state transitions for the shared initiative tracker. State:
// { combatants: [{ id, name, initiative, hp, isPlayer, playerId,
//                  conditions: [{ id, name, rounds }] }],
//   turn: index into the sorted list, round: 1-based, started: bool,
//   expired: [{ combatant, condition }] — conditions that just ran out,
//   combat: bool — the app is in combat mode for everyone,
//   alert: { id, at } — the DM's latest "roll for initiative" call }
// `playerId` links a combatant to the player who plays it (for "your
// turn" alerts); `rounds` counts down at the start of that combatant's
// turn, and null means "until removed".

export const emptyEncounter = () => ({
  combatants: [],
  turn: 0,
  round: 1,
  started: false,
  expired: [],
  combat: false,
  alert: null,
})

// The DM's "Roll for initiative!": a fresh encounter in combat mode, with
// an alert every player's device shows once.
export function callForInitiative(alert) {
  return { ...emptyEncounter(), combat: true, alert }
}

// Alerts this old aren't shown to someone who opens the app later.
export const ALERT_FRESH_MS = 5 * 60 * 1000

export function isFreshAlert(alert, seenIds, now) {
  if (!alert?.id || seenIds.includes(alert.id)) return false
  const at = new Date(alert.at).getTime()
  return Number.isFinite(at) && now - at < ALERT_FRESH_MS
}

// Fills in fields older saved encounters may lack.
export function normalizeEncounter(state) {
  if (!state || !Array.isArray(state.combatants)) return emptyEncounter()
  return {
    ...emptyEncounter(),
    ...state,
    combatants: state.combatants.map((c) => ({ ...c, conditions: Array.isArray(c.conditions) ? c.conditions : [] })),
    expired: Array.isArray(state.expired) ? state.expired : [],
    combat: Boolean(state.combat),
    alert: state.alert?.id ? state.alert : null,
  }
}

// Whose turn it is and who's after them (null before combat starts).
export function turnInfo(state) {
  const { combatants, started, turn } = state
  if (!started || !combatants.length) return { current: null, next: null }
  return {
    current: combatants[turn] || null,
    next: combatants.length > 1 ? combatants[(turn + 1) % combatants.length] : null,
  }
}

// The combatant whose turn is starting loses a round from each timed
// condition; ones that reach zero are removed and listed in `expired`.
function startTurnOf(state) {
  const current = state.combatants[state.turn]
  if (!current) return { ...state, expired: [] }
  const expired = []
  const conditions = []
  for (const condition of current.conditions || []) {
    if (condition.rounds == null) {
      conditions.push(condition)
    } else if (condition.rounds <= 1) {
      expired.push({ combatant: current.name, condition: condition.name })
    } else {
      conditions.push({ ...condition, rounds: condition.rounds - 1 })
    }
  }
  return {
    ...state,
    expired,
    combatants: state.combatants.map((c) => (c.id === current.id ? { ...c, conditions } : c)),
  }
}

export function addCondition(state, combatantId, condition) {
  return {
    ...state,
    combatants: state.combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: [...(c.conditions || []), condition] } : c,
    ),
  }
}

export function removeCondition(state, combatantId, conditionId) {
  return {
    ...state,
    combatants: state.combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: (c.conditions || []).filter((x) => x.id !== conditionId) } : c,
    ),
  }
}

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

// Starting combat begins the first combatant's turn without ticking
// their conditions (nothing has elapsed yet); every later turn ticks.
export function nextTurn(state) {
  if (!state.combatants.length) return state
  if (!state.started) return { ...state, started: true, turn: 0, round: 1, expired: [] }
  const turn = state.turn + 1
  if (turn >= state.combatants.length) return startTurnOf({ ...state, turn: 0, round: state.round + 1 })
  return startTurnOf({ ...state, turn })
}

// Going back is a correction, so it doesn't restore ticked conditions.
export function previousTurn(state) {
  if (!state.combatants.length || !state.started) return state
  if (state.turn > 0) return { ...state, turn: state.turn - 1, expired: [] }
  if (state.round > 1) return { ...state, turn: state.combatants.length - 1, round: state.round - 1, expired: [] }
  return state
}
