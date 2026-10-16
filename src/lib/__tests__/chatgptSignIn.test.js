import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHATGPT_AUTHORIZE_URL,
  buildAuthorizeUrl,
  connectionFromTokens,
  finishChatGptSignIn,
  freshChatGptConnection,
  isChatGptSignInEnabled,
  pkceChallenge,
  responsesText,
} from '../chatgptSignIn.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('sign in with ChatGPT', () => {
  it('is switched off without a client ID', () => {
    expect(isChatGptSignInEnabled()).toBe(false)
  })

  it('makes the RFC 7636 PKCE challenge', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('asks OpenAI for sign-in plus plan usage', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'app_1', redirectUri: 'https://x.test/', state: 's', nonce: 'n', codeChallenge: 'c' }),
    )
    expect(`${url.origin}${url.pathname}`).toBe(CHATGPT_AUTHORIZE_URL)
    expect(url.searchParams.get('scope')).toContain('chatgpt.tokens.use.direct')
    expect(url.searchParams.get('resource')).toBe('https://api.openai.com/v1')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('reads the reply text from the Responses API', () => {
    expect(responsesText({ output_text: '{"a":1}' })).toBe('{"a":1}')
    expect(
      responsesText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"b":' }, { type: 'output_text', text: '2}' }] }] }),
    ).toBe('{"b":2}')
  })

  it('keeps who signed in and when the token expires', () => {
    const c = connectionFromTokens(
      { access_token: 'at', refresh_token: 'rt', expires_in: 3600, id_token: `x.${b64url({ email: 'sam@x.test', name: 'Sam' })}.y` },
      { now: 1000 },
    )
    expect(c).toMatchObject({ provider: 'chatgpt', accessToken: 'at', refreshToken: 'rt', email: 'sam@x.test', expiresAt: 1000 + 3600_000 })
  })

  it('finishes a sign-in callback through the auth function, and ignores other page loads', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test')
    const session = memoryStorage()
    session.setItem('dnd-notes-chatgpt-signin', JSON.stringify({ verifier: 'v', state: 'st', nonce: 'n', returnTo: '/' }))
    const replaceState = vi.fn()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('window', { location: { origin: 'https://x.test', href: '' }, history: { replaceState } })
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'at', expires_in: 60 }) }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await finishChatGptSignIn('https://x.test/')).toBeNull() // no code: not a callback
    expect(await finishChatGptSignIn('https://x.test/?code=c&state=wrong')).toBeNull() // someone else's state

    const c = await finishChatGptSignIn('https://x.test/?code=c&state=st')
    expect(c.accessToken).toBe('at')
    expect(replaceState).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toBe('https://sb.test/functions/v1/chatgpt-auth')
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toMatchObject({ action: 'exchange', code: 'c', code_verifier: 'v', redirect_uri: 'https://x.test/', nonce: 'n' })
    expect(session.getItem('dnd-notes-chatgpt-signin')).toBeNull()
  })

  it('renews an access token that is about to expire', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'new', expires_in: 3600 }) })))
    const save = vi.fn()
    const old = { provider: 'chatgpt', accessToken: 'old', refreshToken: 'rt', expiresAt: Date.now() + 1000, email: 'sam@x.test', model: 'm' }
    const next = await freshChatGptConnection(old, save)
    expect(next).toMatchObject({ accessToken: 'new', refreshToken: 'rt', email: 'sam@x.test', model: 'm' })
    expect(save).toHaveBeenCalledWith(next)
    const fresh = { ...old, expiresAt: Date.now() + 3600_000 }
    expect(await freshChatGptConnection(fresh, save)).toBe(fresh)
  })
})
