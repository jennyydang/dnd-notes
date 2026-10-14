// Pure state transitions for the shared initiative tracker. State:
// { combatants: [{ id, name, initiative, hp, isPlayer, playerId,
//                  conditions: [{ id, name, rounds }] }],
//   turn: index into the sorted list, round: 1-based, started: bool,
//   expired: [{ combatant, condition }] — conditions that just ran out,
//   combat: bool — the app is in combat mode for everyone,
//   alert: { id, at, dice } — the DM's latest "roll for initiative" call,
//   dice: { sides, mode: 'normal' | 'advantage' | 'disadvantage' } }
// The list's order is the turn order: adding anyone re-sorts it by
// initiative; the DM can also drag rows (handy for breaking ties).
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

// Keeps the same creature "up" after the list changes around it.
function keepTurn(state, combatants) {
  const current = state.combatants[state.turn]
  const turn = state.started && current ? combatants.findIndex((c) => c.id === current.id) : 0
  return { ...state, combatants, turn: Math.max(0, turn) }
}

// Adds a combatant and re-sorts the order by initiative, highest first.
// Ties keep their current order, so where the DM has dragged tied
// combatants to break a tie, that sticks.
export function addCombatant(state, combatant) {
  const combatants = [...state.combatants, combatant]
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.initiative - a.c.initiative || a.index - b.index)
    .map(({ c }) => c)
  return keepTurn(state, combatants)
}

// The DM dragging a combatant to a new position.
export function moveCombatant(state, id, toIndex) {
  const from = state.combatants.findIndex((c) => c.id === id)
  if (from === -1) return state
  const to = Math.max(0, Math.min(state.combatants.length - 1, toIndex))
  if (to === from) return state
  const combatants = [...state.combatants]
  const [moved] = combatants.splice(from, 1)
  combatants.splice(to, 0, moved)
  return keepTurn(state, combatants)
}

// A player's own roll from the app: replaces any earlier entry of theirs
// and slots them into the order by the new total.
export function addPlayerRoll(state, combatant) {
  const without = state.combatants.filter((c) => !(combatant.playerId && c.playerId === combatant.playerId))
  const kept = state.combatants.find((c) => combatant.playerId && c.playerId === combatant.playerId)
  const base = keepTurn(state, without)
  return addCombatant(base, kept ? { ...kept, ...combatant, id: kept.id, conditions: kept.conditions || [] } : combatant)
}

export const DICE_MODES = {
  normal: 'Normal',
  advantage: 'Advantage',
  disadvantage: 'Disadvantage',
}
export const INITIATIVE_DICE = [20, 12, 10, 8, 6, 4]
export const defaultDice = () => ({ sides: 20, mode: 'normal' })

// "d20", "d20 with advantage", "d12 with disadvantage".
export function describeDice(dice) {
  const { sides, mode } = { ...defaultDice(), ...dice }
  return `d${sides}${mode === 'normal' ? '' : ` with ${mode}`}`
}

// Rolls the DM's dice; `random` returns [0, 1) (Math.random by default).
// { rolls: [n] or [n, n], die: the one that counts, total }.
export function rollInitiative(dice, bonus = 0, random = Math.random) {
  const { sides, mode } = { ...defaultDice(), ...dice }
  const roll = () => 1 + Math.floor(random() * sides)
  const rolls = mode === 'normal' ? [roll()] : [roll(), roll()]
  const die = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0]
  return { rolls, die, total: die + (Number(bonus) || 0) }
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
