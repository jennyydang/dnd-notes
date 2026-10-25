import { useState } from 'react'
import Modal from '../Modal.jsx'
import { SectionCard } from '../ui.jsx'
import Icon from '../Icon.jsx'
import { PAIN_LEVELS, REST_HEALING, byPain, painLabel, regionLabel, worstPain } from '../../lib/injuries.js'

// The figure faces you, so the character's right side is drawn on the
// viewer's left.
// Simple front-facing figure on a 120×240 grid. `label` is where the pain
// number is drawn so the level never relies on colour alone.
const SHAPES = {
  head: { d: 'M60 8a16 16 0 1 1 0 32a16 16 0 1 1 0-32z', label: [60, 28] },
  chest: { d: 'M40 46h40a6 6 0 0 1 6 6v38H34V52a6 6 0 0 1 6-6z', label: [60, 72] },
  stomach: { d: 'M35 93h50v31a8 8 0 0 1-8 8H43a8 8 0 0 1-8-8z', label: [60, 114] },
  'right-arm': { d: 'M31 50a6 6 0 0 0-8 3L12 118a6 6 0 0 0 5 7l5 1a6 6 0 0 0 7-5l3-26z', label: [22, 96] },
  'left-arm': { d: 'M89 50a6 6 0 0 1 8 3l11 65a6 6 0 0 1-5 7l-5 1a6 6 0 0 1-7-5l-3-26z', label: [98, 96] },
  'right-leg': { d: 'M37 135h21l-2 92a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z', label: [47, 186] },
  'left-leg': { d: 'M62 135h21l-1 92a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z', label: [73, 186] },
}

// Combat injuries: tap where the character got hit, rate the pain, add a
// note. Saved on the character sheet (mechanics.injuries) like HP.
function InjuriesPanel({ sheetApi }) {
  const { sheet, updateMechanics } = sheetApi
  const [editing, setEditing] = useState(null) // { region, pain, note }

  if (!sheet) return null
  const injuries = sheet.mechanics.injuries || []
  const byRegion = Object.fromEntries(injuries.map((i) => [i.region, i]))
  const worst = worstPain(injuries)
  const sorted = byPain(injuries)

  function open(region) {
    const existing = byRegion[region]
    setEditing({ region, pain: existing?.pain ?? 0, note: existing?.note ?? '', isNew: !existing })
  }

  function save(event) {
    event.preventDefault()
    if (!editing.pain) return
    const entry = { region: editing.region, pain: editing.pain, note: editing.note.trim(), at: new Date().toISOString() }
    updateMechanics((m) => ({
      injuries: [...(m.injuries || []).filter((i) => i.region !== editing.region), entry],
    }))
    setEditing(null)
  }

  function remove(region) {
    updateMechanics((m) => ({ injuries: (m.injuries || []).filter((i) => i.region !== region) }))
    setEditing(null)
  }

  function clearAll() {
    if (window.confirm('Fully healed? This clears every injury (say, after healing magic or a healer’s care).')) {
      updateMechanics({ injuries: [] })
    }
  }

  const regionButton = (id) => {
    const injury = byRegion[id]
    const name = regionLabel(id)
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': injury ? `${name}: ${injury.pain} of 5, ${painLabel(injury.pain)}. Edit` : `${name}: not hurt. Mark an injury`,
      onClick: () => open(id),
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open(id)
        }
      },
    }
  }

  return (
    <SectionCard
      title="Injuries"
      icon="target"
      className="injuries"
      action={
        injuries.length > 0 && (
          <button type="button" className="btn btn--text" onClick={clearAll}>
            Fully healed
          </button>
        )
      }
    >
      <div className="injuries__layout">
        <div className="injuries__figure-wrap">
          <svg className="injuries__figure" viewBox="0 0 120 240" role="group" aria-label="Body — tap where you were hit">
            {Object.entries(SHAPES).map(([id, shape]) => {
              const injury = byRegion[id]
              return (
                <g key={id} className={`injuries__region injuries__region--pain-${injury?.pain || 0}`} {...regionButton(id)}>
                  <path d={shape.d} />
                  {injury && (
                    <text x={shape.label[0]} y={shape.label[1]} textAnchor="middle" dominantBaseline="middle">
                      {injury.pain}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          <button
            type="button"
            className={`chip injuries__back${byRegion.back ? ` injuries__back--pain-${byRegion.back.pain}` : ''}`}
            onClick={() => open('back')}
          >
            Back{byRegion.back ? ` · ${byRegion.back.pain}` : ''}
          </button>
          <p className="injuries__hint">Facing you — your right side is on the left.</p>
        </div>

        <div className="injuries__list-wrap">
          {injuries.length === 0 ? (
            <p className="inline-state">No injuries. Tap the figure where you get hit.</p>
          ) : (
            <>
              <p className="injuries__worst">
                Worst pain: <strong>{worst} · {painLabel(worst)}</strong>
              </p>
              <p className="injuries__rest">
                Rests ease every injury: a short rest by {REST_HEALING.short}, a long rest by {REST_HEALING.long}.
              </p>
              <ul className="injuries__list">
                {sorted.map((i) => (
                  <li key={i.region} className={`injuries__item injuries__item--pain-${i.pain}`}>
                    <button type="button" className="injuries__item-open" onClick={() => open(i.region)}>
                      <span className="injuries__item-pain" aria-hidden="true">
                        {i.pain}
                      </span>
                      <span className="injuries__item-text">
                        <span className="injuries__item-region">
                          {regionLabel(i.region)} · {painLabel(i.pain)}
                        </span>
                        {i.note && <span className="injuries__item-note">{i.note}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => remove(i.region)}
                      aria-label={`Remove ${regionLabel(i.region)} injury`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} label={`${regionLabel(editing.region)} injury`}>
          <form className="injury-form form-stack" onSubmit={save}>
            <h3 className="section-card__title">
              <Icon name="target" /> {regionLabel(editing.region)}
            </h3>
            <fieldset className="injury-form__pain">
              <legend>How much does it hurt?</legend>
              <div className="chip-row" role="radiogroup" aria-label="Pain level">
                {PAIN_LEVELS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={editing.pain === p.value}
                    className={`chip injury-form__level injury-form__level--pain-${p.value}${editing.pain === p.value ? ' chip--active' : ''}`}
                    onClick={() => setEditing({ ...editing, pain: p.value })}
                  >
                    <strong>{p.value}</strong> {p.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="injury-note">What hit you? (optional)</label>
              <input
                id="injury-note"
                type="text"
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                placeholder="Goblin arrow, still stuck in"
              />
            </div>
            <div className="form-actions">
              {!editing.isNew && (
                <button type="button" className="btn btn--danger injury-form__remove" onClick={() => remove(editing.region)}>
                  Healed — remove
                </button>
              )}
              <button type="button" className="btn btn--text" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={!editing.pain}>
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  )
}

export default InjuriesPanel
