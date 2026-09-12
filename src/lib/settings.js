// Simple per-browser display preferences (background/font/text size) —
// not campaign data, so localStorage rather than Supabase is the right
// home for it. Applied as data-* attributes on <html> so plain CSS
// attribute selectors (see src/styles/_base.scss) can override the
// compile-time defaults at runtime, no component prop-drilling needed.
const STORAGE_KEY = 'dnd-notes:settings'

const DEFAULTS = {
  bg: 'vista',
  font: 'classic',
  fontSize: 'medium',
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSetting(key, value) {
  const current = getSettings()
  const next = { ...current, [key]: value }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the
    // setting still applies for this page load via applySettings below,
    // it just won't persist across a reload.
  }
  return next
}

export function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore — see saveSetting
  }
  return { ...DEFAULTS }
}

// Each attribute is only set when it differs from the default, so the
// default look never depends on this module having run — it's just
// today's plain CSS with no attribute present at all.
export function applySettings(settings) {
  const root = document.documentElement
  const applied = { ...DEFAULTS, ...settings }

  if (applied.bg !== DEFAULTS.bg) root.setAttribute('data-bg', applied.bg)
  else root.removeAttribute('data-bg')

  if (applied.font !== DEFAULTS.font) root.setAttribute('data-font', applied.font)
  else root.removeAttribute('data-font')

  if (applied.fontSize !== DEFAULTS.fontSize) root.setAttribute('data-font-size', applied.fontSize)
  else root.removeAttribute('data-font-size')
}
