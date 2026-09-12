import { useState } from 'react'
import { applySettings, getSettings, resetSettings, saveSetting } from '../lib/settings.js'
import './SettingsPanel.scss'

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

  function choose(key, value) {
    const next = saveSetting(key, value)
    applySettings(next)
    setSettings(next)
  }

  function reset() {
    const next = resetSettings()
    applySettings(next)
    setSettings(next)
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
