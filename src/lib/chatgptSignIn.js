// "Sign in with ChatGPT": a player connects their ChatGPT account and the
// roleplay assistant runs on their ChatGPT plan's included usage — no API
// key. OpenAI offers this to websites as a limited trial for approved
// partners, so it's switched OFF until the app is approved and given a
// client ID:
//
//   VITE_CHATGPT_CLIENT_ID      the client ID OpenAI issues (turns it on)
//   VITE_CHATGPT_AUTH_FUNCTION  optional: the token-exchange endpoint;
//                               defaults to the "chatgpt-auth" Supabase
//                               Edge Function (supabase/functions/)
//
// The flow (OpenID Connect with PKCE, per developers.openai.com/siwc):
//  1. startChatGptSignIn() sends the browser to OpenAI's authorize page.
//  2. OpenAI returns to this site with ?code&state; finishChatGptSignIn()
//     (run when the app loads) hands the code + PKCE verifier to the Edge
//     Function, which exchanges it at OpenAI's token endpoint (holding any
//     client secret server-side) and returns the tokens.
//  3. The tokens are kept on this device only (like the API keys in
//     aiConnection.js) and renewed through the same function.
// It hasn't been run against OpenAI's live sign-in (that needs approval
// first), so expect to adjust details when it's switched on.

export const CHATGPT_ISSUER = 'https://auth.openai.com'
export const CHATGPT_AUTHORIZE_URL = `${CHATGPT_ISSUER}/api/accounts/authorize`
export const CHATGPT_RESOURCE = 'https://api.openai.com/v1'
export const CHATGPT_SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
export const CHATGPT_DEFAULT_MODEL = 'gpt-4o-mini'

const PENDING_KEY = 'dnd-notes-chatgpt-signin' // sessionStorage: one sign-in attempt
const ERROR_KEY = 'dnd-notes-chatgpt-signin-error' // a failed sign-in, shown once
const env = import.meta.env || {}

export function chatGptClientId() {
  return env.VITE_CHATGPT_CLIENT_ID || ''
}

// Off unless the app has been given a client ID.
export function isChatGptSignInEnabled() {
  return Boolean(chatGptClientId())
}

function authFunctionUrl() {
  if (env.VITE_CHATGPT_AUTH_FUNCTION) return env.VITE_CHATGPT_AUTH_FUNCTION
  return env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL}/functions/v1/chatgpt-auth` : ''
}

// OpenAI sends the player back to the app's own address.
export function chatGptRedirectUri() {
  return `${window.location.origin}/`
}

const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export function randomString(byteLength = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

// PKCE: the S256 challenge for a verifier.
export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

export function buildAuthorizeUrl({ clientId, redirectUri, state, nonce, codeChallenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: CHATGPT_SCOPES,
    resource: CHATGPT_RESOURCE,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${CHATGPT_AUTHORIZE_URL}?${params}`
}

// Step 1: off to OpenAI. `returnTo` is where in the app to land after.
export async function startChatGptSignIn({ model = '' } = {}) {
  if (!isChatGptSignInEnabled()) throw new Error('Sign in with ChatGPT isn’t switched on for this app yet.')
  const verifier = randomString(48)
  const state = randomString(16)
  const nonce = randomString(16)
  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier, state, nonce, model, returnTo: window.location.pathname + window.location.search }),
  )
  window.location.assign(
    buildAuthorizeUrl({
      clientId: chatGptClientId(),
      redirectUri: chatGptRedirectUri(),
      state,
      nonce,
      codeChallenge: await pkceChallenge(verifier),
    }),
  )
}

async function callAuthFunction(body) {
  const url = authFunctionUrl()
  if (!url) throw new Error('The ChatGPT sign-in service isn’t set up.')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.VITE_SUPABASE_ANON_KEY
        ? { apikey: env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `ChatGPT sign-in failed (${response.status}).`)
  return data
}

// Name and email from the ID token's claims (shown as "Connected as …").
// It came straight from the token endpoint via our function, so this only
// reads it; the function is where it's checked.
export function idTokenClaims(idToken) {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(payload))))
  } catch {
    return {}
  }
}

export function connectionFromTokens(tokens, { model = '', now = Date.now() } = {}) {
  const claims = tokens.id_token ? idTokenClaims(tokens.id_token) : {}
  return {
    provider: 'chatgpt',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000,
    email: claims.email || '',
    name: claims.name || '',
    model: model || CHATGPT_DEFAULT_MODEL,
  }
}

// Step 2: back from OpenAI. Returns the new connection, or null when this
// page load isn't a sign-in callback. Cleans ?code&state out of the URL.
export async function finishChatGptSignIn(url = window.location.href) {
  const here = new URL(url)
  const code = here.searchParams.get('code')
  const state = here.searchParams.get('state')
  const failed = here.searchParams.get('error')
  let pending = null
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null')
  } catch {
    pending = null
  }
  if (!pending || (!code && !failed) || state !== pending.state) return null
  sessionStorage.removeItem(PENDING_KEY)
  window.history.replaceState(null, '', pending.returnTo || '/')
  if (failed) {
    throw new Error(
      failed === 'access_denied'
        ? 'ChatGPT sign-in was cancelled.'
        : `ChatGPT sign-in failed: ${here.searchParams.get('error_description') || failed}`,
    )
  }
  const tokens = await callAuthFunction({
    action: 'exchange',
    code,
    code_verifier: pending.verifier,
    redirect_uri: chatGptRedirectUri(),
    nonce: pending.nonce,
  })
  if (!tokens.access_token) throw new Error('ChatGPT didn’t return access for this app.')
  return connectionFromTokens(tokens, { model: pending.model })
}

// A sign-in that failed on the way back, for the panel to show (once).
export function rememberChatGptSignInError(message) {
  try {
    sessionStorage.setItem(ERROR_KEY, message)
  } catch {
    // private mode: the panel just won't say why
  }
}

export function takeChatGptSignInError() {
  try {
    const message = sessionStorage.getItem(ERROR_KEY)
    sessionStorage.removeItem(ERROR_KEY)
    return message
  } catch {
    return null
  }
}

// Step 3: an access token lasts about an hour; renew it shortly before.
export async function freshChatGptConnection(connection, save) {
  if (connection.expiresAt - Date.now() > 60_000) return connection
  if (!connection.refreshToken) throw new Error('Your ChatGPT sign-in has expired — sign in again.')
  const tokens = await callAuthFunction({ action: 'refresh', refresh_token: connection.refreshToken })
  const next = {
    ...connectionFromTokens({ ...tokens, refresh_token: tokens.refresh_token || connection.refreshToken }, { model: connection.model }),
    email: connection.email,
    name: connection.name,
  }
  save?.(next)
  return next
}

// The Responses API's reply text.
export function responsesText(data) {
  if (typeof data?.output_text === 'string') return data.output_text
  return (data?.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

// One prompt, run on the player's ChatGPT plan.
export async function askChatGpt(connection, prompt, { signal, maxTokens = 1200, save } = {}) {
  const live = await freshChatGptConnection(connection, save)
  const response = await fetch(`${CHATGPT_RESOURCE}/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${live.accessToken}` },
    body: JSON.stringify({
      model: live.model || CHATGPT_DEFAULT_MODEL,
      input: prompt,
      max_output_tokens: maxTokens,
      text: { format: { type: 'json_object' } },
    }),
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message
    if (response.status === 401) throw new Error('Your ChatGPT sign-in has expired — sign in again.')
    if (response.status === 429) throw new Error('You’ve reached your ChatGPT plan’s limit for this app for now.')
    throw new Error(`ChatGPT returned an error (${response.status})${message ? `: ${message}` : ''}.`)
  }
  return responsesText(data)
}
