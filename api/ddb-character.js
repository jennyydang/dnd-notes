// Vercel Function: GET /api/ddb-character?id=<number>
//
// Fetches a *public* D&D Beyond character from D&D Beyond's (unofficial,
// undocumented) character service and returns its JSON. It runs on the
// server because D&D Beyond doesn't allow browsers on other sites to call
// it directly. Only a numeric character ID is accepted — never a URL — so
// this can't be used to fetch anything else. No keys or cookies are sent:
// private characters simply can't be read.

const SERVICE = 'https://character-service.dndbeyond.com/character/v5/character'
const TIMEOUT_MS = 10000

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!/^\d{3,12}$/.test(id)) {
    return json(400, { error: 'Send a numeric D&D Beyond character ID.' })
  }

  let upstream
  try {
    upstream = await fetch(`${SERVICE}/${id}?includeCustomItems=true`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AdventurersLog-Importer/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return json(502, { error: 'Couldn’t reach D&D Beyond. Try again, or upload the file instead.' })
  }

  let payload = null
  try {
    payload = await upstream.json()
  } catch {
    // Non-JSON (an error page, or D&D Beyond blocking the request).
  }

  if (upstream.status === 403 || upstream.status === 401 || payload?.message?.toLowerCase?.().includes('private')) {
    return json(403, { error: 'That character is private. Set its privacy to Public on D&D Beyond and try again.' })
  }
  if (upstream.status === 404) {
    return json(404, { error: 'No D&D Beyond character has that ID.' })
  }
  if (!upstream.ok || !payload || payload.success === false || !payload.data) {
    return json(502, {
      error: payload?.message || `D&D Beyond didn’t return the character (status ${upstream.status}). Try uploading the file instead.`,
    })
  }
  return json(200, { data: payload.data })
}
