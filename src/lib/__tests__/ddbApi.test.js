import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../../../api/ddb-character.js'

const call = (id) => GET(new Request(`http://localhost/api/ddb-character?id=${encodeURIComponent(id)}`))
const upstream = (status, body) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))

afterEach(() => vi.restoreAllMocks())

describe('GET /api/ddb-character', () => {
  it('rejects anything but a numeric ID without calling D&D Beyond', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    for (const bad of ['', 'abc', 'https://evil.example/1234', '12', '1234567890123']) {
      expect((await call(bad)).status).toBe(400)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns the character data', async () => {
    const spy = upstream(200, { success: true, data: { id: 123456, name: 'Seiya' } })
    const res = await call('123456')
    expect(res.status).toBe(200)
    expect((await res.json()).data.name).toBe('Seiya')
    expect(spy.mock.calls[0][0]).toBe('https://character-service.dndbeyond.com/character/v5/character/123456?includeCustomItems=true')
  })

  it('explains private, missing and unreachable characters', async () => {
    upstream(403, { success: false, message: 'Forbidden' })
    expect((await (await call('123456')).json()).error).toMatch(/private/)
    vi.restoreAllMocks()
    upstream(404, 'Not found')
    expect((await call('123456')).status).toBe(404)
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    expect((await call('123456')).status).toBe(502)
  })
})
