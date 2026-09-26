import { useRef, useState } from 'react'
import { useCampaignData } from '../../hooks/useCampaignData.js'
import {
  TONES,
  buildAssistantPrompt,
  isAssistantConfigured,
  matchingQuirks,
  requestSuggestions,
} from '../../lib/roleplayAssistant.js'
import { sessionDateTimestamp } from '../../lib/sessionNotes.js'
import { Chip, SectionCard } from '../ui.jsx'

// Recorded campaign context the player can opt into sending: the latest
// session recap and open quests — facts they wrote, nothing inferred.
function campaignContext(entities) {
  const latest = entities
    .filter((e) => e.type === 'session')
    .sort((a, b) => sessionDateTimestamp(b.raw.session_date) - sessionDateTimestamp(a.raw.session_date))[0]
  const quests = entities.filter((e) => e.type === 'quest' && e.open).map((q) => q.title)
  return [
    latest && `Latest session (${latest.title}): ${latest.body.slice(0, 900)}`,
    quests.length && `Open quests: ${quests.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function SuggestionCard({ suggestion, onDismiss }) {
  const [s, setS] = useState(suggestion)
  const [copied, setCopied] = useState(false)
  const parts = [
    ['dialogue', 'Says'],
    ['action', 'Does'],
    ['thought', 'Thinks (private)'],
  ]
  return (
    <li className="assistant__suggestion">
      {s.tone && <span className="assistant__tone">{s.tone}</span>}
      {parts.map(([key, label]) => (
        <div key={key} className="field">
          <label htmlFor={`${s.id}-${key}`}>{label}</label>
          <textarea
            id={`${s.id}-${key}`}
            className="field--wide"
            rows={2}
            value={s[key]}
            onChange={(e) => setS({ ...s, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="btn btn--text" onClick={onDismiss}>
          Dismiss
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => setCopied(await copyText(s.dialogue || s.action))}
        >
          {copied ? '✓ Copied' : 'Copy line'}
        </button>
      </div>
    </li>
  )
}

// Helps the player find the character's voice for a moment. With a
// connected endpoint it offers editable suggestions split into dialogue /
// action / private thought; without one it says so and offers the prompt
// to copy, plus the character's own matching quirks and voice lines.
function RoleplayAssistant({ character, narrative }) {
  const { entities } = useCampaignData()
  const [scene, setScene] = useState('')
  const [tones, setTones] = useState(['gentle', 'dry'])
  const [includeContext, setIncludeContext] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)
  const configured = isAssistantConfigured()

  const prompt = scene.trim()
    ? buildAssistantPrompt({
        character,
        narrative,
        scene,
        tones,
        campaignContext: includeContext ? campaignContext(entities) : '',
      })
    : ''
  const reminders = scene.trim() ? matchingQuirks(narrative.quirks, scene) : []

  async function ask(event) {
    event.preventDefault()
    if (!scene.trim()) {
      setError('Describe the scene or what was said first.')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setError(null)
    try {
      const result = await requestSuggestions({ prompt, character, scene, tones, signal: controller.signal })
      setSuggestions(result)
      setStatus(result.length ? 'done' : 'empty')
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setStatus('error')
    }
  }

  const toggleTone = (id) => setTones((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))

  return (
    <SectionCard title="Roleplay assistant" icon="💬" className="assistant narrative">
      {!configured && (
        <p className="assistant__notice" role="note">
          <strong>No AI model is connected</strong>, so this won&apos;t generate replies. You can
          still copy a ready-made prompt (built from {character.name}&apos;s roleplay notes) into any
          assistant, and see which of {character.name}&apos;s own quirks fit the scene.
        </p>
      )}

      <form className="form-stack" onSubmit={ask}>
        <div className="field">
          <label htmlFor="assistant-scene">What&apos;s happening?</label>
          <textarea
            id="assistant-scene"
            className="field--wide"
            rows={4}
            value={scene}
            onChange={(e) => {
              setScene(e.target.value)
              setError(null)
              setCopied(false)
            }}
            placeholder="The wounded mercenary grabs my sleeve and asks if he's going to die."
          />
        </div>
        <div className="chip-row" role="group" aria-label="Tones">
          {TONES.map((t) => (
            <Chip key={t.id} active={tones.includes(t.id)} onClick={() => toggleTone(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <label className="assistant__context">
          <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} />
          Include my latest session recap and open quests
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            disabled={!prompt}
            onClick={async () => setCopied(await copyText(prompt))}
          >
            {copied ? '✓ Prompt copied' : 'Copy prompt'}
          </button>
          {configured && (
            <button type="submit" className="btn btn--primary" disabled={status === 'loading'}>
              {status === 'loading' ? 'Thinking…' : 'Suggest reactions'}
            </button>
          )}
        </div>
      </form>

      {reminders.length > 0 && (
        <div className="assistant__reminders">
          <h4>Quirks that might fit (optional)</h4>
          <ul>
            {reminders.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ul>
        </div>
      )}
      {!configured && scene.trim() && narrative.voiceExamples.length > 0 && (
        <div className="assistant__reminders">
          <h4>{character.name}&apos;s voice</h4>
          <ul>
            {narrative.voiceExamples.map((line, i) => (
              <li key={i}>“{line}”</li>
            ))}
          </ul>
        </div>
      )}

      {status === 'empty' && <p className="inline-state">No suggestions came back. Try adding more detail.</p>}
      {suggestions.length > 0 && (
        <ul className="assistant__suggestions">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} onDismiss={() => setSuggestions((all) => all.filter((x) => x.id !== s.id))} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export default RoleplayAssistant
