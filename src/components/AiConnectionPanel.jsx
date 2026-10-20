import { useEffect, useState } from 'react'
import { useAiConnection } from '../hooks/useAiConnection.js'
import { AI_CONNECTION_EVENT, PROVIDERS, maskKey, saveAiConnection, testAiConnection } from '../lib/aiConnection.js'
import { isChatGptSignInEnabled, startChatGptSignIn, takeChatGptSignInError } from '../lib/chatgptSignIn.js'
import Icon from './Icon.jsx'
import './AiConnectionPanel.scss'

// "Sign in with ChatGPT" — shown only once the app is approved and has a
// client ID (lib/chatgptSignIn.js). Runs on the player's ChatGPT plan.
function ChatGptSignInButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => takeChatGptSignInError())
  // A sign-in that fails after this is already on screen.
  useEffect(() => {
    const onChange = () => {
      const message = takeChatGptSignInError()
      if (message) setError(message)
    }
    window.addEventListener(AI_CONNECTION_EVENT, onChange)
    return () => window.removeEventListener(AI_CONNECTION_EVENT, onChange)
  }, [])
  return (
    <div className="ai-connect__signin">
      <button
        type="button"
        className="btn btn--primary ai-connect__chatgpt"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await startChatGptSignIn()
          } catch (err) {
            setError(err.message)
            setBusy(false)
          }
        }}
      >
        <Icon name="link" /> {busy ? 'Opening ChatGPT…' : 'Sign in with ChatGPT'}
      </button>
      <p className="field-hint">Uses your ChatGPT plan — no API key needed.</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Connect the player's own AI account for the roleplay assistant: Sign in
// with ChatGPT (when switched on), or a Claude / ChatGPT API key, checked
// with a tiny request and kept on this device only.
function AiConnectionPanel({ compact = false }) {
  const connection = useAiConnection()
  const chatGptSignIn = isChatGptSignInEnabled()
  const [editing, setEditing] = useState(false)
  const [provider, setProvider] = useState(connection?.provider || 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(connection?.model || '')
  const [status, setStatus] = useState('idle') // idle | testing
  const [error, setError] = useState(null)
  const info = PROVIDERS[provider]

  async function connect(event) {
    event.preventDefault()
    const key = apiKey.trim()
    if (!key) {
      setError('Paste your API key first.')
      return
    }
    const next = { provider, apiKey: key, model: model.trim() || info.defaultModel }
    setStatus('testing')
    setError(null)
    try {
      await testAiConnection(next)
      saveAiConnection(next)
      setEditing(false)
      setApiKey('')
    } catch (err) {
      setError(
        err.name === 'TypeError'
          ? `Couldn’t reach ${info.short} — check your connection and try again.`
          : err.message,
      )
    } finally {
      setStatus('idle')
    }
  }

  if (connection?.provider === 'chatgpt') {
    return (
      <div className={`ai-connect ai-connect--on${compact ? ' ai-connect--compact' : ''}`}>
        <p className="ai-connect__status">
          <Icon name="check-square" /> Signed in with <strong>ChatGPT</strong>
          <span className="ai-connect__meta">
            {[connection.email, connection.model, 'your ChatGPT plan', 'this device'].filter(Boolean).join(' · ')}
          </span>
        </p>
        <div className="ai-connect__actions">
          <button
            type="button"
            className="btn btn--text ai-connect__disconnect"
            onClick={() => window.confirm('Sign out of ChatGPT on this device?') && saveAiConnection(null)}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (connection && !editing) {
    const p = PROVIDERS[connection.provider]
    return (
      <div className={`ai-connect ai-connect--on${compact ? ' ai-connect--compact' : ''}`}>
        <p className="ai-connect__status">
          <Icon name="check-square" /> Connected to <strong>{p.short}</strong>
          <span className="ai-connect__meta">
            {connection.model} · key {maskKey(connection.apiKey)} · this device
          </span>
        </p>
        <div className="ai-connect__actions">
          <button
            type="button"
            className="btn btn--text"
            onClick={() => {
              setProvider(connection.provider)
              setModel(connection.model)
              setEditing(true)
            }}
          >
            Change
          </button>
          <button
            type="button"
            className="btn btn--text ai-connect__disconnect"
            onClick={() => window.confirm(`Disconnect ${p.short}? Your key is removed from this device.`) && saveAiConnection(null)}
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  if (!editing && compact) {
    return (
      <div className="ai-connect ai-connect--compact">
        <p className="ai-connect__lead">
          Connect your own <strong>Claude</strong> or <strong>ChatGPT</strong> account to get suggestions here.
        </p>
        {chatGptSignIn ? (
          <>
            <ChatGptSignInButton />
            <button type="button" className="btn btn--text" onClick={() => setEditing(true)}>
              Use an API key instead
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
            <Icon name="link" /> Connect AI
          </button>
        )}
      </div>
    )
  }

  return (
    <form className="ai-connect" onSubmit={connect}>
      {chatGptSignIn && !compact && (
        <>
          <ChatGptSignInButton />
          <p className="ai-connect__or">or use an API key</p>
        </>
      )}
      <div className="ai-connect__providers" role="radiogroup" aria-label="AI service">
        {Object.values(PROVIDERS).map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={provider === p.id}
            className={`chip${provider === p.id ? ' chip--active' : ''}`}
            onClick={() => {
              setProvider(p.id)
              setModel('')
              setError(null)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="ai-key">{info.short} API key</label>
        <input
          id="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={info.keyHint}
        />
        <p className="field-hint">
          Make one at{' '}
          <a href={info.keyUrl} target="_blank" rel="noreferrer">
            {info.keySite}
          </a>
          . It’s billed by {info.short === 'Claude' ? 'Anthropic' : 'OpenAI'} per use — separate from a{' '}
          {info.short === 'Claude' ? 'Claude Pro' : 'ChatGPT Plus'} subscription, which other apps can’t use.
        </p>
      </div>
      <div className="field">
        <label htmlFor="ai-model">Model</label>
        <input
          id="ai-model"
          type="text"
          spellCheck={false}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={info.defaultModel}
        />
      </div>
      <p className="ai-connect__privacy">
        <Icon name="lock" /> Your key is saved on this device only and sent straight to {info.short} — never to this
        app’s database or other players.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {(connection || compact) && (
          <button type="button" className="btn btn--text" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={status === 'testing'}>
          {status === 'testing' ? 'Checking…' : 'Connect'}
        </button>
      </div>
    </form>
  )
}

export default AiConnectionPanel
