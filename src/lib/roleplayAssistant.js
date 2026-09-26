// Roleplay assistant service. This app has no AI model of its own, and a
// model API key must never ship in client code — so suggestions come from
// an optional server endpoint (e.g. a Supabase Edge Function holding the
// key) configured via VITE_ROLEPLAY_ASSISTANT_URL. Without one, the UI says
// so plainly and offers the same prompt to copy into any assistant.
//
// Endpoint contract (POST, JSON):
//   request:  { prompt, character: { name, summary }, scene, tones }
//   response: { suggestions: [{ tone, dialogue, action, thought }] }

export const TONES = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'dry', label: 'Dry' },
  { id: 'curious', label: 'Curious' },
  { id: 'composed', label: 'Composed' },
]

const MAX_SCENE = 2000
const MAX_CONTEXT = 1500

export function assistantEndpoint() {
  return import.meta.env?.VITE_ROLEPLAY_ASSISTANT_URL || ''
}

export function isAssistantConfigured() {
  return Boolean(assistantEndpoint())
}

const section = (title, body) => (body && String(body).trim() ? `${title}:\n${String(body).trim()}\n` : '')
const list = (items) => items.filter(Boolean).map((i) => `- ${i}`).join('\n')

// Builds the instructions sent to a model (or copied by the player). Only
// facts the player has written down are included, and the model is told
// not to invent campaign facts or decide for the character.
export function buildAssistantPrompt({ character, narrative, scene, tones = [], campaignContext = '' }) {
  const n = narrative
  const toneLabels = tones.length
    ? tones.map((t) => TONES.find((x) => x.id === t)?.label || t).join(', ')
    : 'a range of tones that fit the character'
  const profile = [
    section('Identity', [character.name, character.race_class, character.level && `level ${character.level}`].filter(Boolean).join(', ')),
    section('Background', n.background),
    section('Public persona', n.publicPersona),
    section('Private thoughts', n.privateThoughts),
    section('Personality', n.personality),
    section('Ideals', n.ideals),
    section('Bonds', n.bonds),
    section('Flaws', n.flaws),
    section('Motivations', n.motivations),
    section('Philosophy', n.philosophy),
    section('History', n.history),
    section('Dialogue guidance', n.dialogueGuidance),
    section('Voice examples', list(n.voiceExamples.map((v) => `"${v}"`))),
    section('Optional quirks (use only if they fit the scene)', list(n.quirks.map((q) => (q.context ? `${q.text} (when: ${q.context})` : q.text)))),
    section('Relationships', list(n.relationships.map((r) => [r.name, r.bond, r.notes].filter(Boolean).join(' — ')))),
    section('Weaknesses', n.weaknesses),
  ].join('')

  return [
    `You help a tabletop RPG player roleplay their character, ${character.name}. Offer options; the player decides what the character does.`,
    '',
    'CHARACTER (only use these facts; do not invent new campaign facts, names or history):',
    profile.trim() || '(No roleplay notes recorded yet.)',
    '',
    campaignContext.trim() ? `CAMPAIGN CONTEXT (as recorded by the player):\n${campaignContext.trim().slice(0, MAX_CONTEXT)}\n` : '',
    `SCENE:\n${scene.trim().slice(0, MAX_SCENE)}`,
    '',
    `Give 3 short possible reactions in the character's established voice, in ${toneLabels}.`,
    'For each, separate: spoken dialogue, observable action, and private thought.',
    'Keep quirks contextual and optional. Do not make decisions for the character.',
    'Reply as JSON: {"suggestions":[{"tone":"","dialogue":"","action":"","thought":""}]}',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export function parseSuggestions(payload) {
  const raw = payload?.suggestions
  if (!Array.isArray(raw)) throw new Error('The assistant replied in an unexpected format.')
  return raw
    .filter((s) => s && typeof s === 'object')
    .map((s, i) => ({
      id: `${Date.now()}-${i}`,
      tone: String(s.tone || ''),
      dialogue: String(s.dialogue || ''),
      action: String(s.action || ''),
      thought: String(s.thought || ''),
    }))
    .filter((s) => s.dialogue || s.action || s.thought)
}

export async function requestSuggestions({ prompt, character, scene, tones, signal }) {
  const url = assistantEndpoint()
  if (!url) throw new Error('No roleplay assistant is connected.')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, character: { name: character.name, summary: character.race_class }, scene, tones }),
    signal,
  })
  if (!response.ok) throw new Error(`The assistant returned an error (${response.status}).`)
  return parseSuggestions(await response.json())
}

// Offline help: the character's own quirks whose "when" words appear in
// the scene — a reminder, not generated text.
export function matchingQuirks(quirks, scene) {
  const words = new Set(scene.toLowerCase().match(/[a-z]{4,}/g) || [])
  return quirks.filter((q) => {
    const contextWords = `${q.context} ${q.text}`.toLowerCase().match(/[a-z]{4,}/g) || []
    return contextWords.some((w) => words.has(w) || words.has(w.replace(/s$/, '')))
  })
}
