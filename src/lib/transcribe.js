import { supabase } from './supabaseClient.js'
import { getPlayerSession } from './auth.js'
import { askModel, extractJson, getAiConnection } from './aiConnection.js'
import { loadRecordingBlob } from './sessionRecorder.js'
import { toEditorContent } from './richNotes.js'

// Session recording → timed transcript → draft recap.
//
// Transcribing uses OpenAI's Whisper with the player's own API key (Claude
// can't listen to audio). A player connected with Claude can add an
// OpenAI key just for this; like the main key it stays on this device.
// Drafting the recap from the transcript works with either provider.

export const TRANSCRIBE_MODEL = 'whisper-1'
export const PRICE_PER_MINUTE = 0.006 // USD, OpenAI's Whisper price
const CHUNK_SECONDS = 20 * 60

function keyStorage() {
  return `dnd-notes-ai-transcribe:${getPlayerSession()?.playerId || 'admin'}`
}

// The OpenAI key to transcribe with: the AI connection's own if it's
// OpenAI, else one saved for transcription.
export function getTranscribeKey() {
  const connection = getAiConnection()
  if (connection?.provider === 'openai') return connection.apiKey
  try {
    return localStorage.getItem(keyStorage()) || null
  } catch {
    return null
  }
}

export function saveTranscribeKey(key) {
  try {
    if (key) localStorage.setItem(keyStorage(), key.trim())
    else localStorage.removeItem(keyStorage())
  } catch {
    // private mode: the key just isn't remembered
  }
}

export const estimateCost = (seconds) => (seconds ? Math.max(0.01, (seconds / 60) * PRICE_PER_MINUTE) : null)

async function transcribeChunk(apiKey, blob, offset, prompt) {
  const form = new FormData()
  form.append('file', blob, 'chunk.webm')
  form.append('model', TRANSCRIBE_MODEL)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  if (prompt) form.append('prompt', prompt)
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) throw new Error('OpenAI didn’t accept that API key. Check it, or make a new one.')
    if (response.status === 429) throw new Error('OpenAI says you’re over your limit or out of credit (429).')
    throw new Error(`OpenAI returned an error (${response.status})${data?.error?.message ? `: ${data.error.message}` : ''}.`)
  }
  return (data.segments || [])
    .map((s) => ({ start: round(s.start + offset), end: round(s.end + offset), text: String(s.text || '').trim() }))
    .filter((s) => s.text)
}

const round = (n) => Math.round(n * 10) / 10

// Names from the campaign, so Whisper spells "Strahd" and "Ireena" right.
export function namesPrompt(names) {
  const unique = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
  let out = ''
  for (const name of unique) {
    if ((out + name).length > 600) break
    out += (out ? ', ' : '') + name
  }
  return out ? `A Dungeons & Dragons session. Names: ${out}.` : 'A Dungeons & Dragons session.'
}

// Transcribes a recap's recording and saves it. onProgress({ stage, value })
// with stage 'loading' | 'preparing' | 'transcribing'.
export async function transcribeSession(session, { apiKey, names = [], onProgress } = {}) {
  if (!apiKey) throw new Error('Add an OpenAI API key to transcribe.')
  const blob = await loadRecordingBlob(session, (value) => onProgress?.({ stage: 'loading', value }))
  const { splitForTranscription } = await import('./audioExport.js')
  onProgress?.({ stage: 'preparing', value: 0 })
  const chunks = await splitForTranscription(blob, session.audioSeconds, CHUNK_SECONDS, (value) =>
    onProgress?.({ stage: 'preparing', value }),
  )
  const prompt = namesPrompt(names)
  const segments = []
  for (const [i, chunk] of chunks.entries()) {
    onProgress?.({ stage: 'transcribing', value: i / chunks.length })
    segments.push(...(await transcribeChunk(apiKey, chunk.blob, chunk.start, prompt)))
  }
  onProgress?.({ stage: 'transcribing', value: 1 })
  await saveTranscript(session.id, segments, session.audioPath)
  return segments
}

export async function loadTranscript(sessionId) {
  const { data, error } = await supabase.from('session_transcripts').select('*').eq('session_id', sessionId).maybeSingle()
  if (error) {
    if (/session_transcripts/.test(error.message)) return null // table not created yet
    throw new Error(error.message)
  }
  return data ? { segments: Array.isArray(data.segments) ? data.segments : [], audioPath: data.audio_path } : null
}

async function saveTranscript(sessionId, segments, audioPath) {
  const { error } = await supabase
    .from('session_transcripts')
    .upsert({ session_id: sessionId, segments, audio_path: audioPath, created_at: new Date().toISOString() })
  if (error) {
    throw new Error(
      /session_transcripts/.test(error.message)
        ? 'Saving transcripts needs the latest supabase/schema.sql (the session_transcripts table).'
        : error.message,
    )
  }
}

export async function removeTranscript(sessionId) {
  const { error } = await supabase.from('session_transcripts').delete().eq('session_id', sessionId)
  if (error && !/session_transcripts/.test(error.message)) throw new Error(error.message)
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function transcriptText(segments) {
  return segments.map((s) => `[${clock(s.start)}] ${s.text}`).join('\n')
}

// The segment playing at `t` seconds (or the last one before it).
export function segmentAt(segments, t) {
  let found = -1
  for (let i = 0; i < segments.length && segments[i].start <= t; i++) found = i
  return found
}

// ── Draft recap ──────────────────────────────────────────────────────────

// Long sessions are trimmed to stay well inside the models' limits.
const MAX_TRANSCRIPT_CHARS = 180000

export function recapPrompt({ title, segments, marks = [], names = [] }) {
  let text = transcriptText(segments)
  if (text.length > MAX_TRANSCRIPT_CHARS) text = `${text.slice(0, MAX_TRANSCRIPT_CHARS)}\n[…transcript trimmed…]`
  const markLines = marks.map((m) => `- [${clock(m.t)}] ${m.label || 'Bookmark'}`).join('\n')
  return `You are the scribe for a Dungeons & Dragons group. Below is the transcript of a recorded session${title ? ` titled "${title}"` : ''}. It mixes in-character play, rules talk and table chatter; the speakers aren't labelled.

Write a recap of what happened IN THE GAME, for the players to read before next session:
- Past tense, third person, as a story ("The party crossed…"). Skip rules talk, dice maths and out-of-game chatter.
- Cover the key events in order, NPCs met, places visited, loot found, choices made, and where things were left.
- Spell names as they appear in this list when they come up: ${names.slice(0, 80).join(', ') || '(none)'}.
- 3 to 8 short paragraphs. Don't invent events that aren't in the transcript.
${markLines ? `\nThe players bookmarked these moments; make sure they're covered:\n${markLines}\n` : ''}
Reply with only this JSON: {"recap": ["paragraph", "paragraph", ...], "highlights": ["one-line highlight", ...]}

Transcript:
${text}`
}

export async function draftRecap({ title, segments, marks, names }) {
  const connection = getAiConnection()
  if (!connection) throw new Error('Connect an AI account (Settings → AI assistant) to draft a recap.')
  const reply = await askModel(connection, recapPrompt({ title, segments, marks, names }), { maxTokens: 3000 })
  const json = extractJson(reply)
  const recap = (Array.isArray(json.recap) ? json.recap : [json.recap]).map((p) => String(p || '').trim()).filter(Boolean)
  if (!recap.length) throw new Error('The assistant didn’t return a recap.')
  return { recap, highlights: (json.highlights || []).map((h) => String(h).trim()).filter(Boolean) }
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The draft as editor HTML, added after whatever the recap already says.
export function appendDraftToNotes(notes, { recap, highlights }) {
  const html = [
    '<h3>Recap (drafted from the recording)</h3>',
    ...recap.map((p) => `<p>${escapeHtml(p)}</p>`),
    highlights.length ? `<ul>${highlights.map((h) => `<li><p>${escapeHtml(h)}</p></li>`).join('')}</ul>` : '',
  ].join('')
  return `${toEditorContent(String(notes || '').trim())}${html}`
}
