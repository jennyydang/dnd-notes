import { useState } from 'react'
import {
  CONDITIONS,
  SPELL_LEVELS,
  applyHpChange,
  formatModifier,
  initiativeBonus,
  isBlank,
  passivePerception,
  proficiencyBonus,
} from '../../lib/character.js'
import { Chip, SaveStatus, SectionCard, Stepper } from '../ui.jsx'

function StatTile({ label, value, hint }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value ?? '—'}</span>
      {hint && <span className="stat-tile__hint">{hint}</span>}
    </div>
  )
}

// HP, defences, conditions, concentration, spell slots and resources for
// live play (sheetApi = useCharacterSheet(), owned by SessionMode). Every number comes from the character sheet; anything not
// filled in shows a dash and a pointer to the sheet, never a made-up value.
function VitalsPanel({ character, sheetApi, onEditSheet }) {
  const { sheet, loading, error, status, saveError, retry, updateMechanics } = sheetApi
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState(null)
  const [lastChange, setLastChange] = useState(null)

  if (loading) return <SectionCard title="Vitals" icon="❤️"><p className="inline-state">Loading sheet…</p></SectionCard>
  if (!sheet) {
    return (
      <SectionCard title="Vitals" icon="❤️">
        <p className="inline-state inline-state--error">{error || 'Couldn’t load the character sheet.'}</p>
      </SectionCard>
    )
  }

  const m = sheet.mechanics
  const level = character.level
  const hp = m.hp
  const hpKnown = !isBlank(hp.max)
  const current = isBlank(hp.current) ? (hpKnown ? Number(hp.max) : null) : Number(hp.current)
  const pct = hpKnown && current !== null ? Math.max(0, Math.min(100, (current / Number(hp.max)) * 100)) : 0
  const hpState = !hpKnown ? '' : current === 0 ? 'down' : pct <= 25 ? 'critical' : pct <= 50 ? 'bloodied' : 'healthy'
  const hpStateLabel = { down: 'Down', critical: 'Critical', bloodied: 'Bloodied', healthy: '' }[hpState]

  function applyAmount(sign) {
    const n = Math.floor(Number(amount))
    if (!amount || !Number.isFinite(n) || n <= 0) {
      setAmountError('Enter a positive number.')
      return
    }
    setAmountError(null)
    const before = { ...hp, current: current ?? 0 }
    const after = applyHpChange(before, sign * n)
    updateMechanics({
      hp: after,
      // Reaching 0 HP starts death saves fresh; being healed clears them.
      deathSaves: after.current > 0 || before.current > 0 ? { success: 0, failure: 0 } : m.deathSaves,
    })
    setLastChange({ before: hp, label: `${sign < 0 ? 'Took' : 'Healed'} ${n}` })
    setAmount('')
  }

  function undoHp() {
    if (!lastChange) return
    updateMechanics({ hp: lastChange.before })
    setLastChange(null)
  }

  const slots = SPELL_LEVELS.map((lvl) => ({ lvl, ...(m.spellSlots[lvl] || { max: 0, used: 0 }) })).filter(
    (s) => s.max > 0,
  )

  function toggleSlot(lvl, index) {
    updateMechanics((mech) => {
      const slot = mech.spellSlots[lvl] || { max: 0, used: 0 }
      // Tapping a filled pip spends up to it; tapping a spent one restores.
      const used = index < slot.used ? index : index + 1
      return { spellSlots: { ...mech.spellSlots, [lvl]: { ...slot, used } } }
    })
  }

  function toggleCondition(name) {
    updateMechanics((mech) => ({
      conditions: mech.conditions.includes(name)
        ? mech.conditions.filter((c) => c !== name)
        : [...mech.conditions, name],
    }))
  }

  function setResource(id, currentValue) {
    updateMechanics((mech) => ({
      resources: mech.resources.map((r) => (r.id === id ? { ...r, current: currentValue } : r)),
    }))
  }

  function rest(kind) {
    updateMechanics((mech) => {
      const resources = mech.resources.map((r) =>
        r.reset === 'short' || (kind === 'long' && r.reset === 'long') ? { ...r, current: r.max } : r,
      )
      if (kind === 'short') return { resources }
      const spellSlots = Object.fromEntries(
        Object.entries(mech.spellSlots).map(([lvl, s]) => [lvl, { ...s, used: 0 }]),
      )
      return {
        resources,
        spellSlots,
        hp: isBlank(mech.hp.max) ? mech.hp : { ...mech.hp, current: Number(mech.hp.max), temp: 0 },
        deathSaves: { success: 0, failure: 0 },
        exhaustion: Math.max(0, (mech.exhaustion || 0) - 1),
      }
    })
  }

  const init = initiativeBonus(m)
  const passive = passivePerception(m, level)

  return (
    <SectionCard
      title={character.name}
      icon="❤️"
      className="vitals mechanics"
      action={<SaveStatus status={status} error={saveError} onRetry={retry} />}
    >
      <div className={`vitals__hp vitals__hp--${hpState || 'unknown'}`}>
        <div className="vitals__hp-numbers">
          <span className="vitals__hp-label">Hit points</span>
          {hpKnown ? (
            <span className="vitals__hp-value" aria-live="polite">
              {current}
              <span className="vitals__hp-max"> / {hp.max}</span>
              {hp.temp > 0 && <span className="vitals__hp-temp"> +{hp.temp} temp</span>}
            </span>
          ) : (
            <button type="button" className="btn btn--text vitals__setup" onClick={onEditSheet}>
              Set max HP on the character sheet →
            </button>
          )}
          {hpStateLabel && <span className="vitals__hp-state">{hpStateLabel}</span>}
        </div>
        {hpKnown && (
          <div
            className="vitals__hp-bar"
            role="meter"
            aria-label="Hit points"
            aria-valuemin={0}
            aria-valuemax={Number(hp.max)}
            aria-valuenow={current ?? 0}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {hpKnown && (
          <div className="vitals__hp-controls">
            <label htmlFor="hp-amount" className="sr-only">
              Amount
            </label>
            <input
              id="hp-amount"
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setAmountError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyAmount(-1)
              }}
              placeholder="Amount"
              aria-invalid={Boolean(amountError)}
            />
            <button type="button" className="btn btn--danger vitals__big-btn" onClick={() => applyAmount(-1)}>
              − Damage
            </button>
            <button type="button" className="btn vitals__big-btn" onClick={() => applyAmount(1)}>
              + Heal
            </button>
            <div className="vitals__temp">
              <span className="vitals__mini-label">Temp HP</span>
              <Stepper
                compact
                label="temporary hit points"
                value={hp.temp || 0}
                onChange={(v) => updateMechanics({ hp: { ...hp, temp: v } })}
              />
            </div>
          </div>
        )}
        {amountError && <p className="field-error">{amountError}</p>}
        {lastChange && (
          <p className="field-hint" role="status">
            {lastChange.label}.{' '}
            <button type="button" className="btn btn--text vitals__undo" onClick={undoHp}>
              Undo
            </button>
          </p>
        )}
      </div>

      {hpKnown && current === 0 && (
        <div className="vitals__death">
          <span className="vitals__mini-label">Death saves</span>
          <div className="vitals__death-row">
            <span>Successes</span>
            <Stepper compact label="death save successes" value={m.deathSaves.success} max={3} onChange={(v) => updateMechanics({ deathSaves: { ...m.deathSaves, success: v } })} />
            <span>Failures</span>
            <Stepper compact label="death save failures" value={m.deathSaves.failure} max={3} onChange={(v) => updateMechanics({ deathSaves: { ...m.deathSaves, failure: v } })} />
          </div>
        </div>
      )}

      <div className="vitals__tiles">
        <StatTile label="AC" value={isBlank(m.ac) ? null : m.ac} />
        <StatTile label="Initiative" value={init === null ? null : formatModifier(init)} />
        <StatTile label="Speed" value={isBlank(m.speed) ? null : `${m.speed} ft`} />
        <StatTile label="Proficiency" value={formatModifier(proficiencyBonus(level))} hint={`Level ${level}`} />
        <StatTile label="Passive Perc." value={passive} />
      </div>
      {(isBlank(m.ac) || isBlank(m.speed) || init === null) && (
        <p className="field-hint">
          Missing stats show “—”.{' '}
          <button type="button" className="btn btn--text vitals__setup" onClick={onEditSheet}>
            Fill them in on the sheet
          </button>
        </p>
      )}

      <div className="vitals__block">
        <div className="vitals__row-head">
          <span className="vitals__mini-label">Concentration</span>
          <Chip
            active={m.concentration.active}
            onClick={() => updateMechanics({ concentration: { ...m.concentration, active: !m.concentration.active } })}
          >
            {m.concentration.active ? 'Concentrating' : 'Not concentrating'}
          </Chip>
        </div>
        {m.concentration.active && (
          <input
            type="text"
            className="vitals__concentration-input"
            value={m.concentration.spell}
            onChange={(e) => updateMechanics({ concentration: { ...m.concentration, spell: e.target.value } })}
            placeholder="On which spell?"
            aria-label="Concentration spell"
          />
        )}
      </div>

      <div className="vitals__block">
        <span className="vitals__mini-label">Conditions</span>
        <div className="chip-row">
          {CONDITIONS.filter((c) => c !== 'Exhaustion').map((name) => (
            <Chip key={name} active={m.conditions.includes(name)} onClick={() => toggleCondition(name)}>
              {name}
            </Chip>
          ))}
        </div>
        <div className="vitals__row-head">
          <span>Exhaustion level</span>
          <Stepper compact label="exhaustion level" value={m.exhaustion || 0} max={6} onChange={(v) => updateMechanics({ exhaustion: v })} />
        </div>
      </div>

      <div className="vitals__block">
        <span className="vitals__mini-label">Spell slots</span>
        {slots.length === 0 ? (
          <p className="field-hint">
            No spell slots set.{' '}
            <button type="button" className="btn btn--text vitals__setup" onClick={onEditSheet}>
              Add them on the sheet
            </button>
          </p>
        ) : (
          <ul className="vitals__slots">
            {slots.map((s) => (
              <li key={s.lvl}>
                <span className="vitals__slot-level">Level {s.lvl}</span>
                <span className="vitals__pips">
                  {Array.from({ length: s.max }, (_, i) => {
                    const available = i >= s.used
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`vitals__pip${available ? ' vitals__pip--available' : ''}`}
                        onClick={() => toggleSlot(s.lvl, i)}
                        aria-label={`Level ${s.lvl} slot ${i + 1}: ${available ? 'available, tap to spend' : 'spent, tap to restore'}`}
                      >
                        {available ? '◆' : '◇'}
                      </button>
                    )
                  })}
                </span>
                <span className="vitals__slot-count">
                  {s.max - s.used}/{s.max}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {m.resources.length > 0 && (
        <div className="vitals__block">
          <span className="vitals__mini-label">Resources</span>
          <ul className="vitals__resources">
            {m.resources.map((r) => (
              <li key={r.id}>
                <span>
                  {r.name || 'Unnamed'}
                  {r.reset && <span className="field-hint"> · {r.reset} rest</span>}
                </span>
                <Stepper compact label={r.name || 'resource'} value={r.current ?? 0} max={r.max ?? Infinity} onChange={(v) => setResource(r.id, v)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-actions vitals__rests">
        <button type="button" className="btn" onClick={() => rest('short')}>
          Short rest
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (window.confirm('Long rest: restore HP, spell slots and rest-based resources?')) rest('long')
          }}
        >
          Long rest
        </button>
      </div>
    </SectionCard>
  )
}

export default VitalsPanel
