import { getPlayerSession } from './auth.js'

// A player's own AI account, used by the roleplay assistant: an API key
// for Claude (Anthropic) or ChatGPT (OpenAI). Subscriptions like Claude
// Pro or ChatGPT Plus can't be linked to other apps — API keys are how
// these services let an app call them, billed per use to the player.
//
// The key stays on this device (localStorage) and goes only to the
// provider, straight from the browser. It's never saved to Supabase:
// the app's tables are readable with its public key, so a key stored
// there would be anyone's to take.
export const PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    short: 'Claude',
    defaultModel: 'claude-sonnet-5-5',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keySite: 'console.anthropic.com',
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    short: 'ChatGPT',
    defaultModel: 'gpt-4o-mini',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    keySite: 'platform.openai.com',
  },
}

export const AI_CONNECTION_EVENT = 'dnd-notes-ai-connection'

function storageKey() {
  const playerId = getPlayerSession()?.playerId || 'admin'
  return `dnd-notes-ai:${playerId}`
}

// { provider, apiKey, model } or null.
export function getAiConnection() {
  try {
    const raw = localStorage.getItem(storageKey())
    const value = raw ? JSON.parse(raw) : null
    return value && PROVIDERS[value.provider] && value.apiKey ? value : null
  } catch {
    return null
  }
}

export function saveAiConnection(connection) {
  try {
    if (connection) localStorage.setItem(storageKey(), JSON.stringify(connection))
    else localStorage.removeItem(storageKey())
  } finally {
    window.dispatchEvent(new Event(AI_CONNECTION_EVENT))
  }
}

export const maskKey = (key) => (key ? `••••${key.slice(-4)}` : '')

// The model's reply text for one prompt.
export async function askModel({ provider, apiKey, model }, prompt, { signal, maxTokens = 1200 } = {}) {
  const chosen = model?.trim() || PROVIDERS[provider].defaultModel
  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Allows a call straight from the browser with the player's own key.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: chosen, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(providerError('Claude', response.status, data?.error?.message))
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: chosen,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(providerError('ChatGPT', response.status, data?.error?.message))
  return data.choices?.[0]?.message?.content || ''
}

function providerError(name, status, message) {
  if (status === 401) return `${name} didn’t accept that API key. Check it, or make a new one.`
  if (status === 429) return `${name} says you’re over your limit or out of credit (429).`
  if (status === 404) return `${name} doesn’t know that model${message ? `: ${message}` : '.'}`
  return `${name} returned an error (${status})${message ? `: ${message}` : ''}.`
}

// Checks a key with a tiny request before it's saved.
export async function testAiConnection(connection) {
  const prompt = 'Reply with the JSON {"ok":true} and nothing else.'
  await askModel(connection, prompt, { maxTokens: 20 })
}

// Pulls the JSON object out of a reply (models sometimes wrap it in
// ```json fences or a sentence).
export function extractJson(text) {
  const trimmed = String(text || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        // fall through
      }
    }
    throw new Error('The assistant replied in an unexpected format.')
  }
}
