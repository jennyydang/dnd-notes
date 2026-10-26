import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { removeImage, uploadImage } from '../../lib/storage.js'
import {
  CLOTH,
  DEFAULT_SPRITE,
  EYE,
  H,
  HAIR,
  OPTIONS,
  RACES,
  SKIN,
  VIEWS,
  W,
  WALK,
  applyRace,
  drawToCanvas,
  randomSprite,
  renderSprite,
  sheetBlob,
  spriteBlob,
} from '../../lib/sprite.js'
import { downloadFile, safeFileName } from '../../lib/exportNotes.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import './SpriteCreator.scss'

const VIEW_LABELS = { front: 'Front', right: 'Right', back: 'Back', left: 'Left' }

function SpriteCanvas({ config, view, frame, scale, className, label }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawToCanvas(ctx, renderSprite(config, view, frame), scale)
  }, [config, view, frame, scale])
  return <canvas ref={ref} width={W * scale} height={H * scale} className={className} role="img" aria-label={label} />
}

function Swatches({ label, palette, value, onChange }) {
  return (
    <fieldset className="sprite-maker__field">
      <legend>{label}</legend>
      <div className="sprite-maker__swatches" role="radiogroup" aria-label={label}>
        {Object.entries(palette).map(([id, colors]) => {
          const color = Array.isArray(colors) ? colors[0] : colors
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value === id}
              aria-label={id}
              title={id}
              className={`sprite-maker__swatch${value === id ? ' is-active' : ''}`}
              style={{ '--swatch': color }}
              onClick={() => onChange(id)}
            />
          )
        })}
      </div>
    </fieldset>
  )
}

function Choices({ label, options, value, onChange }) {
  return (
    <fieldset className="sprite-maker__field">
      <legend>{label}</legend>
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={`chip${value === id ? ' chip--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// Build a chibi pixel sprite for a character, see it walk from every side,
// and save it as their sprite (shown in trades and the equipment window).
function SpriteCreator({ member, onClose, onSaved }) {
  const [config, setConfig] = useState(() => ({ ...DEFAULT_SPRITE, ...(member?.sprite_config || {}) }))
  const [view, setView] = useState(0)
  const [tick, setTick] = useState(0)
  const [walking, setWalking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (value) => setConfig((c) => ({ ...c, [key]: value }))

  useEffect(() => {
    if (!walking) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 220)
    return () => clearInterval(id)
  }, [walking])
  const frame = walking ? WALK[tick % WALK.length] : 0
  const turn = (d) => setView((v) => (v + d + VIEWS.length) % VIEWS.length)

  async function save() {
    if (!member) return
    setSaving(true)
    setError(null)
    try {
      const blob = await spriteBlob(config)
      const file = new File([blob], `${safeFileName(member.name)}-sprite.png`, { type: 'image/png' })
      const path = await uploadImage('party-portraits', file, { compress: false })
      let { error: saveError } = await supabase
        .from('party_members')
        .update({ sprite_path: path, sprite_config: config })
        .eq('id', member.id)
      // Before the sprite_config column exists, still save the picture.
      if (saveError && /sprite_config/.test(saveError.message)) {
        ;({ error: saveError } = await supabase.from('party_members').update({ sprite_path: path }).eq('id', member.id))
      }
      if (saveError) {
        await removeImage('party-portraits', path)
        throw new Error(/sprite_path/.test(saveError.message) ? 'Run the latest supabase/schema.sql first (it adds sprites).' : saveError.message)
      }
      if (member.sprite_path) await removeImage('party-portraits', member.sprite_path)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function downloadSheet() {
    const blob = await sheetBlob(config)
    downloadFile(`${safeFileName(member?.name || 'character')}-sprite-sheet.png`, blob, 'image/png')
  }

  return (
    <Modal onClose={onClose} label="Sprite creator" size="trade">
      <div className="sprite-maker">
        <section className="game-window sprite-maker__stage-window">
          <header className="game-window__title">
            <span>Character</span>
            <span className="game-window__owner">{member?.name || 'New sprite'}</span>
          </header>
          <div className="sprite-maker__stage">
            <button type="button" className="sprite-maker__turn" onClick={() => turn(-1)} aria-label="Turn left">
              <Icon name="prev" />
            </button>
            <SpriteCanvas
              config={config}
              view={VIEWS[view]}
              frame={frame}
              scale={8}
              className="sprite-maker__preview"
              label={`${member?.name || 'Character'} sprite, ${VIEW_LABELS[VIEWS[view]]}`}
            />
            <button type="button" className="sprite-maker__turn" onClick={() => turn(1)} aria-label="Turn right">
              <Icon name="next" />
            </button>
          </div>
          <div className="sprite-maker__views">
            {VIEWS.map((v, i) => (
              <button
                key={v}
                type="button"
                className={`sprite-maker__view${view === i ? ' is-active' : ''}`}
                onClick={() => setView(i)}
                aria-label={`${VIEW_LABELS[v]} view`}
                aria-pressed={view === i}
              >
                <SpriteCanvas config={config} view={v} frame={walking ? WALK[(tick + i) % WALK.length] : 0} scale={2} label="" />
                <span>{VIEW_LABELS[v]}</span>
              </button>
            ))}
          </div>
          <div className="sprite-maker__stage-actions">
            <button type="button" className="btn btn--text" onClick={() => setWalking((w) => !w)}>
              <Icon name={walking ? 'pause' : 'play'} /> {walking ? 'Stand still' : 'Walk'}
            </button>
            <button type="button" className="btn btn--text" onClick={() => setConfig(randomSprite())}>
              <Icon name="dice" /> Randomize
            </button>
            <button type="button" className="btn btn--text" onClick={downloadSheet}>
              <Icon name="download" /> Sprite sheet
            </button>
          </div>
        </section>

        <div className="sprite-maker__options">
          <Choices
            label="Race"
            options={Object.entries(RACES).map(([id, r]) => [id, r.label])}
            value={config.race}
            onChange={(race) => setConfig((c) => applyRace(c, race))}
          />
          <Swatches label="Skin" palette={SKIN} value={config.skin} onChange={set('skin')} />
          <Choices label="Hair" options={OPTIONS.hairStyle} value={config.hairStyle} onChange={set('hairStyle')} />
          <Swatches label="Hair colour" palette={HAIR} value={config.hairColor} onChange={set('hairColor')} />
          <Choices label="Eyes" options={OPTIONS.eyes} value={config.eyes} onChange={set('eyes')} />
          <Swatches label="Eye colour" palette={EYE} value={config.eyeColor} onChange={set('eyeColor')} />
          <fieldset className="sprite-maker__field">
            <legend>Traits</legend>
            <div className="chip-row">
              {[
                ['ears', 'Pointed ears'],
                ['horns', 'Horns'],
                ['beard', 'Beard'],
                ['tusks', 'Tusks'],
              ].map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={Boolean(config[key])}
                  className={`chip${config[key] ? ' chip--active' : ''}`}
                  onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>
          <Choices label="Outfit" options={OPTIONS.outfit} value={config.outfit} onChange={set('outfit')} />
          <Swatches label="Outfit colour" palette={CLOTH} value={config.outfitColor} onChange={set('outfitColor')} />
          <Swatches label="Trim, cloak & hat colour" palette={CLOTH} value={config.accentColor} onChange={set('accentColor')} />
          <Swatches label="Boots" palette={CLOTH} value={config.bootsColor} onChange={set('bootsColor')} />
          <Choices label="Headwear" options={OPTIONS.hat} value={config.hat} onChange={set('hat')} />
          <Choices label="Weapon" options={OPTIONS.weapon} value={config.weapon} onChange={set('weapon')} />
          <Choices label="Off hand" options={OPTIONS.offhand} value={config.offhand} onChange={set('offhand')} />
        </div>

        <footer className="sprite-maker__footer">
          {error && <p className="field-error">{error}</p>}
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
          {member && (
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
              <Icon name="check" /> {saving ? 'Saving…' : `Save as ${member.name}’s sprite`}
            </button>
          )}
        </footer>
      </div>
    </Modal>
  )
}

export default SpriteCreator
