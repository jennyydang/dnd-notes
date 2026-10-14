import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applySettings, getSettings } from './lib/settings.js'

// Theme (Parchment / Dungeon) before the first paint, so there's no flash.
applySettings(getSettings())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
