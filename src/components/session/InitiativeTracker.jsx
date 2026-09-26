import { useEffect, useState } from 'react'
import {
  addCombatant,
  emptyEncounter,
  nextTurn,
  previousTurn,
  removeCombatant,
  updateCombatant,
} from '../../lib/initiative.js'
import { getEncounter, setEncounter } from '../../lib/sessionMode.js'
import { newId } from '../../lib/character.js'
import { SectionCard } from '../ui.jsx'

// Turn order for the current fight. Encounters are table-side scratch
// state, so they live in this device's localStorage (surviving refresh)
// rather than the shared database.
function InitiativeTracker({ campaignId, characterName, characterInitBonus }) {
  const [state, setState] = useState(() => getEncounter(campaignId) || emptyEncounter())
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [hp, setHp] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    setEncounter(campaignId, state.combatants.length ? state : null)
  }, [campaignId, state])

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
    setState((s) =>
      addCombatant(s, {
        id: newId(),
        name: trimmed,
        initiative,
        hp: hp === '' ? null : Number(hp),
        isPlayer: trimmed === characterName,
      }),
    )
    setName('')
    setRoll('')
    setHp('')
  }

  function endEncounter() {
    if (window.confirm('End this encounter and clear the initiative order?')) setState(emptyEncounter())
  }

  const current = state.started ? state.combatants[state.turn] : null

  return (
    <SectionCard
      title="Initiative"
      icon="⚔️"
      className="initiative mechanics"
      action={
        state.combatants.length > 0 && (
          <span className="initiative__round">
            {state.started ? `Round ${state.round}` : 'Not started'}
          </span>
        )
      }
    >
      <form className="initiative__add" onSubmit={add} noValidate>
        <div className="field">
          <label htmlFor="init-name">Name</label>
          <input
            id="init-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goblin 1"
          />
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
      {characterName && !state.combatants.some((c) => c.name === characterName) && (
        <button
          type="button"
          className="btn btn--text initiative__me"
          onClick={() => {
            setName(characterName)
            document.getElementById('init-roll')?.focus()
          }}
        >
          + Add {characterName}
          {characterInitBonus !== null && characterInitBonus !== undefined
            ? ` (d20 ${characterInitBonus >= 0 ? '+' : ''}${characterInitBonus})`
            : ''}
        </button>
      )}
      {error && <p className="field-error">{error}</p>}

      {state.combatants.length === 0 ? (
        <p className="inline-state">No one in the fight yet. Add combatants with their initiative rolls.</p>
      ) : (
        <ol className="initiative__list">
          {state.combatants.map((c, index) => {
            const isCurrent = state.started && index === state.turn
            return (
              <li
                key={c.id}
                className={`initiative__row${isCurrent ? ' initiative__row--current' : ''}${c.isPlayer ? ' initiative__row--player' : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="initiative__score">{c.initiative}</span>
                <span className="initiative__name">
                  {isCurrent && <span className="initiative__marker">▶ Now: </span>}
                  {c.name}
                </span>
                {c.hp !== null && c.hp !== undefined && (
                  <label className="initiative__hp">
                    <span className="sr-only">{c.name} HP</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={c.hp}
                      onChange={(e) =>
                        setState((s) => updateCombatant(s, c.id, { hp: e.target.value === '' ? 0 : Number(e.target.value) }))
                      }
                    />
                    <span aria-hidden="true">HP</span>
                  </label>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setState((s) => removeCombatant(s, c.id))}
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {state.combatants.length > 0 && (
        <div className="initiative__controls">
          <button type="button" className="btn" onClick={() => setState(previousTurn)} disabled={!state.started}>
            ◀ Prev
          </button>
          <button type="button" className="btn btn--primary initiative__next" onClick={() => setState(nextTurn)}>
            {state.started ? 'Next turn ▶' : 'Start combat ▶'}
          </button>
          <button type="button" className="btn btn--text" onClick={endEncounter}>
            End encounter
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
