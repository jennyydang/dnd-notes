// Sign in with ChatGPT — the server half (Supabase Edge Function).
//
// The browser (src/lib/chatgptSignIn.js) does the PKCE redirect to OpenAI.
// When OpenAI sends the player back with a code, the app posts it here:
// this function exchanges it at OpenAI's token endpoint — holding the
// client secret, if OpenAI issued one, where the browser can't see it —
// checks the ID token, and returns the tokens. It also renews them.
//
// Switched off until OpenAI approves the app. To turn on:
//   supabase secrets set CHATGPT_CLIENT_ID=... [CHATGPT_CLIENT_SECRET=...] \
//     ALLOWED_ORIGINS=https://dnd-notes.vercel.app
//   supabase functions deploy chatgpt-auth --no-verify-jwt
// and set VITE_CHATGPT_CLIENT_ID on Vercel (same client ID).
//
// Request (POST JSON):
//   { action: 'exchange', code, code_verifier, redirect_uri, nonce }
//   { action: 'refresh', refresh_token }
// Response: { access_token, refresh_token, expires_in, id_token, scope }
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts'

const ISSUER = 'https://auth.openai.com'
const RESOURCE = 'https://api.openai.com/v1'
const PLAN_SCOPE = 'chatgpt.tokens.use.direct'

const CLIENT_ID = Deno.env.get('CHATGPT_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('CHATGPT_CLIENT_SECRET') ?? ''
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

function cors(origin: string | null) {
  const allow = !ALLOWED.length ? '*' : origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  }
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
  })
}

// OpenAI's endpoints and signing keys, from its discovery document.
let discovery: Promise<{ token_endpoint: string; jwks_uri: string }> | null = null
function config() {
  discovery ??= fetch(`${ISSUER}/.well-known/openid-configuration`).then((r) => {
    if (!r.ok) throw new Error(`OpenAI discovery failed (${r.status})`)
    return r.json()
  })
  return discovery
}
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

async function tokenRequest(fields: Record<string, string>) {
  const { token_endpoint } = await config()
  const form = new URLSearchParams({ client_id: CLIENT_ID, resource: RESOURCE, ...fields })
  if (CLIENT_SECRET) form.set('client_secret', CLIENT_SECRET)
  const response = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `OpenAI token request failed (${response.status})`)
  }
  return data
}

// The ID token must be OpenAI's, for this app, unexpired, and from this
// sign-in attempt (nonce).
async function checkIdToken(idToken: string, nonce?: string) {
  const { jwks_uri } = await config()
  jwks ??= createRemoteJWKSet(new URL(jwks_uri))
  const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUER, audience: CLIENT_ID })
  if (nonce && payload.nonce !== nonce) throw new Error('Sign-in check failed (nonce).')
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405, origin)
  if (!CLIENT_ID) return reply({ error: 'Sign in with ChatGPT isn’t switched on (no CHATGPT_CLIENT_ID).' }, 503, origin)

  try {
    const body = await request.json()
    let tokens
    if (body.action === 'exchange') {
      if (!body.code || !body.code_verifier || !body.redirect_uri) return reply({ error: 'Missing code.' }, 400, origin)
      tokens = await tokenRequest({
        grant_type: 'authorization_code',
        code: body.code,
        code_verifier: body.code_verifier,
        redirect_uri: body.redirect_uri,
      })
      if (tokens.id_token) await checkIdToken(tokens.id_token, body.nonce)
    } else if (body.action === 'refresh') {
      if (!body.refresh_token) return reply({ error: 'Missing refresh token.' }, 400, origin)
      tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: body.refresh_token })
    } else {
      return reply({ error: 'Unknown action.' }, 400, origin)
    }
    // Plan usage needs this scope; without it, sign-in alone can't run requests.
    if (tokens.scope && !String(tokens.scope).split(' ').includes(PLAN_SCOPE)) {
      return reply({ error: 'Your ChatGPT account didn’t grant plan usage to this app.' }, 403, origin)
    }
    return reply(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        id_token: tokens.id_token,
        scope: tokens.scope,
      },
      200,
      origin,
    )
  } catch (err) {
    return reply({ error: (err as Error).message }, 400, origin)
  }
})
