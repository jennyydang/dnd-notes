import { useEffect, useRef, useState } from 'react'
import {
  addCombatant,
  addCondition,
  DICE_MODES,
  INITIATIVE_DICE,
  callForInitiative,
  defaultDice,
  describeDice,
  emptyEncounter,
  moveCombatant,
  nextTurn,
  previousTurn,
  removeCombatant,
  removeCondition,
  updateCombatant,
} from '../../lib/initiative.js'
import { CONDITIONS, newId } from '../../lib/character.js'
import { useCampaignData, useCampaignNav } from '../../hooks/useCampaignData.js'
import { useSharedEncounter } from '../../hooks/useSharedEncounter.js'
import { useActiveCharacter } from '../../hooks/useActiveCharacter.js'
import { useDragReorder } from '../../hooks/useDragReorder.js'
import RollForMe from './RollForMe.jsx'
import { SectionCard } from '../ui.jsx'
import Icon from '../Icon.jsx'

// Concentration isn't a 5e condition but is the thing most worth tracking.
const CONDITION_SUGGESTIONS = ['Concentrating', ...CONDITIONS, 'Blessed', 'Hasted', 'Hexed', 'Raging']

// Adds a condition to one combatant: name, plus how many of their turns
// it lasts (blank = until removed).
function ConditionForm({ combatant, onAdd, onClose }) {
  const [name, setName] = useState('')
  const [rounds, setRounds] = useState('')
  const listId = `cond-options-${combatant.id}`
  return (
    <form
      className="initiative__cond-form"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        const n = Number(rounds)
        onAdd({ id: newId(), name: trimmed, rounds: rounds === '' || !Number.isFinite(n) || n < 1 ? null : Math.round(n) })
        onClose()
      }}
    >
      <label className="sr-only" htmlFor={`cond-name-${combatant.id}`}>
        Condition on {combatant.name}
      </label>
      <input
        id={`cond-name-${combatant.id}`}
        list={listId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Condition"
        autoFocus
      />
      <datalist id={listId}>
        {CONDITION_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label className="sr-only" htmlFor={`cond-rounds-${combatant.id}`}>
        Rounds (blank = until removed)
      </label>
      <input
        id={`cond-rounds-${combatant.id}`}
        className="initiative__cond-rounds"
        type="number"
        inputMode="numeric"
        min="1"
        value={rounds}
        onChange={(e) => setRounds(e.target.value)}
        placeholder="rnds"
      />
      <button type="submit" className="btn">
        Add
      </button>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Cancel">
        <Icon name="close" />
      </button>
    </form>
  )
}

// Turn order for the current fight, shared live with everyone in the
// campaign (the DM can run it and players follow along on their phones).
// Party members added here are linked to their player, who then gets a
// "your turn" alert anywhere in the app.
function InitiativeTracker({ characterName, characterInitBonus }) {
  const { campaignId, playerId, tables } = useCampaignData()
  const { isDm } = useCampaignNav()
  const { state, update, shared, error: saveError } = useSharedEncounter(campaignId)
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [hp, setHp] = useState('')
  const [error, setError] = useState(null)
  const [conditionFor, setConditionFor] = useState(null)
  const [dice, setDice] = useState(defaultDice)
  const { character } = useActiveCharacter()
  const drag = useDragReorder((id, to) => update((st) => moveCombatant(st, id, to)))

  const party = tables.character.items
  const playerFor = (combatantName) =>
    party.find((m) => m.name.trim().toLowerCase() === combatantName.trim().toLowerCase())?.claimed_by || null
  const inFight = new Set(state.combatants.map((c) => c.name.trim().toLowerCase()))
  const partyToAdd = party.filter((m) => m.name && !inFight.has(m.name.trim().toLowerCase()))

  // Keep whoever's turn it is in view as the order advances.
  const listRef = useRef(null)
  useEffect(() => {
    if (!state.started) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    listRef.current
      ?.querySelector('.initiative__row--current')
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [state.turn, state.round, state.started])

  function add(event) {
    event.preventDefault()
    const trimmed = name.trim()
    const initiative = Number(roll)
    if (!trimmed) {
      setError('Give the combatant a name.')
      return
    }
    if (roll === '' || !Number.isFinite(initiative)) {
      setError('Enter their initiative roll.')
      return
    }
    setError(null)
    const owner = playerFor(trimmed)
    update((s) =>
      addCombatant(s, {
        id: newId(),
        name: trimmed,
        initiative,
        hp: hp === '' ? null : Number(hp),
        isPlayer: Boolean(owner) || trimmed === characterName,
        playerId: owner || (trimmed === characterName ? playerId || null : null),
        conditions: [],
      }),
    )
    setName('')
    setRoll('')
    setHp('')
  }

  function pickName(value) {
    setName(value)
    document.getElementById('init-roll')?.focus()
  }

  function endEncounter() {
    const message = state.combat
      ? 'End combat? This clears the initiative order and takes everyone out of combat mode.'
      : 'End this encounter and clear the initiative order for everyone?'
    if (window.confirm(message)) update(() => emptyEncounter())
  }

  // DM: alert every player (their screens shake) and switch the app into
  // combat mode, starting a fresh initiative order.
  function callInitiative() {
    if (state.combatants.length && !window.confirm('Start a new encounter? This clears the current initiative order.')) return
    update(() => callForInitiative({ id: newId(), at: new Date().toISOString(), dice }))
  }

  function alertAgain() {
    update((s) => ({ ...s, alert: { id: newId(), at: new Date().toISOString(), dice: s.alert?.dice || dice } }))
  }

  const current = state.started ? state.combatants[state.turn] : null

  return (
    <SectionCard
      title="Initiative"
      icon="quest"
      className="initiative mechanics"
      action={
        state.combatants.length > 0 && (
          <span className="initiative__round">{state.started ? `Round ${state.round}` : 'Not started'}</span>
        )
      }
    >
      {isDm && !state.combat && (
        <div className="initiative__call-box">
          <div className="initiative__dice" role="group" aria-label="Initiative dice">
            <label className="initiative__dice-size">
              <span>Roll</span>
              <select value={dice.sides} onChange={(e) => setDice((d) => ({ ...d, sides: Number(e.target.value) }))}>
                {INITIATIVE_DICE.map((sides) => (
                  <option key={sides} value={sides}>
                    d{sides}
                  </option>
                ))}
              </select>
            </label>
            <div className="initiative__modes" role="radiogroup" aria-label="Advantage">
              {Object.entries(DICE_MODES).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={dice.mode === mode}
                  className={`initiative__mode${dice.mode === mode ? ' initiative__mode--on' : ''}`}
                  onClick={() => setDice((d) => ({ ...d, mode }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn initiative__call" onClick={callInitiative}>
            <Icon name="quest" /> Call for initiative!
            <span className="initiative__call-sub">
              Players roll {describeDice(dice)} · shakes their screens and starts combat mode
            </span>
          </button>
        </div>
      )}
      {state.combat && !state.started && (
        <div className="initiative__rolling" role="status">
          <p>
            <strong>Rolling {describeDice(state.alert?.dice)} for initiative.</strong>{' '}
            {isDm
              ? 'Rolls from the app land in the order by themselves; add anyone else’s as they call them out, then start combat.'
              : 'Roll in the app, or tell your DM your roll.'}
          </p>
          {isDm && (
            <button type="button" className="btn btn--text" onClick={alertAgain}>
              Alert again
            </button>
          )}
          {!isDm && character && (
            <RollForMe key={character.id} character={character} dice={state.alert?.dice} compact />
          )}
        </div>
      )}

      <p className="initiative__shared">
        {shared ? (
          <>
            <span className="initiative__live-dot" aria-hidden="true" /> Shared live with your table
          </>
        ) : (
          'Only on this device. Run the latest supabase/schema.sql to share it with the table.'
        )}
      </p>

      <form className="initiative__add" onSubmit={add} noValidate>
        <div className="field">
          <label htmlFor="init-name">Name</label>
          <input id="init-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goblin 1" />
        </div>
        <div className="field initiative__small">
          <label htmlFor="init-roll">Init</label>
          <input id="init-roll" type="number" inputMode="numeric" value={roll} onChange={(e) => setRoll(e.target.value)} />
        </div>
        <div className="field initiative__small">
          <label htmlFor="init-hp">HP</label>
          <input id="init-hp" type="number" inputMode="numeric" value={hp} onChange={(e) => setHp(e.target.value)} placeholder="opt." />
        </div>
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {partyToAdd.length > 0 && (
        <div className="initiative__party" role="group" aria-label="Add a party member">
          {partyToAdd.map((m) => (
            <button key={m.id} type="button" className="initiative__chip" onClick={() => pickName(m.name)}>
              + {m.name}
              {m.name === characterName && characterInitBonus != null
                ? ` (d20 ${characterInitBonus >= 0 ? '+' : ''}${characterInitBonus})`
                : ''}
            </button>
          ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
      {saveError && <p className="field-error">Couldn’t save for the table: {saveError}</p>}

      {state.expired.length > 0 && (
        <p className="initiative__expired" role="status">
          <Icon name="hourglass" />{' '}
          {state.expired.map((x) => `${x.condition} ended on ${x.combatant}`).join(' · ')}
        </p>
      )}

      {state.combatants.length === 0 ? (
        <p className="inline-state">No one in the fight yet. Add combatants with their initiative rolls.</p>
      ) : (
        <ol className="initiative__list" ref={listRef}>
          {state.combatants.map((c, index) => {
            const isCurrent = state.started && index === state.turn
            const mine = Boolean(playerId) && c.playerId === playerId
            return (
              <li
                key={c.id}
                className={`initiative__row${isCurrent ? ' initiative__row--current' : ''}${c.isPlayer ? ' initiative__row--player' : ''}${mine ? ' initiative__row--mine' : ''}${drag.draggingId === c.id ? ' initiative__row--dragging' : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
                style={isDm ? drag.rowStyle(index) : undefined}
              >
                <div className="initiative__line">
                  {isDm && state.combatants.length > 1 && (
                    <button
                      type="button"
                      className="initiative__grip"
                      aria-label={`Move ${c.name} — drag, or use the up and down arrow keys`}
                      {...drag.handleProps(c.id, index, listRef)}
                    >
                      <Icon name="grip" />
                    </button>
                  )}
                  <span className="initiative__score">{c.initiative}</span>
                  <span className="initiative__name">
                    {isCurrent && (
                      <span className="initiative__marker">
                        <Icon name="play" /> Now:{' '}
                      </span>
                    )}
                    {c.name}
                    {mine && <span className="initiative__you">You</span>}
                  </span>
                  {c.hp !== null && c.hp !== undefined && (
                    <label className="initiative__hp">
                      <span className="sr-only">{c.name} HP</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={c.hp}
                        onChange={(e) =>
                          update((s) => updateCombatant(s, c.id, { hp: e.target.value === '' ? 0 : Number(e.target.value) }))
                        }
                      />
                      <span aria-hidden="true">HP</span>
                    </label>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setConditionFor(conditionFor === c.id ? null : c.id)}
                    aria-label={`Add a condition to ${c.name}`}
                    aria-expanded={conditionFor === c.id}
                  >
                    <Icon name="hourglass" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => update((s) => removeCombatant(s, c.id))}
                    aria-label={`Remove ${c.name}`}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                {c.conditions.length > 0 && (
                  <ul className="initiative__conditions" aria-label={`${c.name}'s conditions`}>
                    {c.conditions.map((x) => (
                      <li key={x.id} className="initiative__condition">
                        {x.name}
                        {x.rounds != null && (
                          <span className="initiative__cond-left" title="Turns left">
                            {x.rounds}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => update((s) => removeCondition(s, c.id, x.id))}
                          aria-label={`Remove ${x.name} from ${c.name}`}
                        >
                          <Icon name="close" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {conditionFor === c.id && (
                  <ConditionForm
                    combatant={c}
                    onAdd={(condition) => update((s) => addCondition(s, c.id, condition))}
                    onClose={() => setConditionFor(null)}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {state.combatants.length > 0 && (
        <div className="initiative__controls">
          <button type="button" className="btn" onClick={() => update(previousTurn)} disabled={!state.started}>
            <Icon name="prev" /> Prev
          </button>
          <button type="button" className="btn btn--primary initiative__next" onClick={() => update(nextTurn)}>
            {state.started ? 'Next turn' : 'Start combat'} <Icon name="next" />
          </button>
          <button type="button" className="btn btn--text" onClick={endEncounter}>
            {state.combat ? 'End combat' : 'End encounter'}
          </button>
        </div>
      )}
      {current && (
        <p className="sr-only" aria-live="polite">
          {current.name}&apos;s turn, round {state.round}
        </p>
      )}
    </SectionCard>
  )
}

export default InitiativeTracker
