import { useRef, useState } from 'react'
import { applySettings, getSettings, resetSettings, saveSetting } from '../lib/settings.js'
import { getPublicUrl, removeImage, uploadImage } from '../lib/storage.js'
import './SettingsPanel.scss'

const BG_BUCKET = 'player-backgrounds'

const BACKGROUNDS = [
  { value: 'vista', label: 'Parchment Vista' },
  { value: 'plain', label: 'Plain Dark' },
]

const FONTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
]

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

// Simple presets, applied instantly on click (no separate Save step) —
// matches how every other toggle in this app behaves, and keeps this
// panel from growing into a full customization UI the user explicitly
// didn't want.
function SettingsPanel({ onDone }) {
  const [settings, setSettings] = useState(() => getSettings())
  const [uploading, setUploading] = useState(false)
  const [bgError, setBgError] = useState(null)
  const fileInputRef = useRef(null)

  function choose(key, value) {
    const next = saveSetting(key, value)
    applySettings(next)
    setSettings(next)
  }

  async function reset() {
    const oldBgPath = settings.customBgPath
    const next = resetSettings()
    applySettings(next)
    setSettings(next)
    if (oldBgPath) {
      try {
        await removeImage(BG_BUCKET, oldBgPath)
      } catch {
        // best-effort cleanup — a leftover object in storage isn't shown
        // anywhere and isn't worth surfacing an error for
      }
    }
  }

  async function handleBgFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setBgError(null)
    try {
      const path = await uploadImage(BG_BUCKET, file)
      saveSetting('customBgPath', path)
      const next = saveSetting('bg', 'custom')
      applySettings(next)
      setSettings(next)
    } catch (err) {
      setBgError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function selectCustomBg() {
    choose('bg', 'custom')
  }

  async function removeCustomBg() {
    const oldBgPath = settings.customBgPath
    saveSetting('customBgPath', null)
    const next = saveSetting('bg', settings.bg === 'custom' ? 'vista' : settings.bg)
    applySettings(next)
    setSettings(next)
    if (oldBgPath) {
      try {
        await removeImage(BG_BUCKET, oldBgPath)
      } catch {
        // best-effort cleanup — see reset()
      }
    }
  }

  function renderGroup(key, options) {
    return (
      <div className="settings-panel__pills" role="group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`settings-panel__pill${settings[key] === opt.value ? ' settings-panel__pill--active' : ''}`}
            aria-pressed={settings[key] === opt.value}
            onClick={() => choose(key, opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="settings-panel">
      <h3>Settings</h3>

      <div className="settings-panel__section">
        <h4>Background</h4>
        {renderGroup('bg', BACKGROUNDS)}

        <div className="settings-panel__custom-bg">
          {settings.customBgPath ? (
            <>
              <button
                type="button"
                className={`settings-panel__bg-thumb${
                  settings.bg === 'custom' ? ' settings-panel__bg-thumb--active' : ''
                }`}
                onClick={selectCustomBg}
                aria-pressed={settings.bg === 'custom'}
                aria-label="Use your uploaded background"
              >
                <img src={getPublicUrl(BG_BUCKET, settings.customBgPath)} alt="Your uploaded background" />
              </button>
              <div className="settings-panel__bg-actions">
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={removeCustomBg}
                  disabled={uploading}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="settings-panel__bg-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : '+ Upload your own'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleBgFileSelected}
          />
        </div>
        {bgError && <p className="empty-state empty-state--error">{bgError}</p>}
      </div>

      <div className="settings-panel__section">
        <h4>Font</h4>
        {renderGroup('font', FONTS)}
      </div>

      <div className="settings-panel__section">
        <h4>Text Size</h4>
        {renderGroup('fontSize', FONT_SIZES)}
      </div>

      <div className="settings-panel__actions">
        <button type="button" className="btn btn--text" onClick={reset}>
          Reset to Defaults
        </button>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

export default SettingsPanel
