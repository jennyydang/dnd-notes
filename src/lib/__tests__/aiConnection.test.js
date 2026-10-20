import { afterEach, describe, expect, it, vi } from 'vitest'
import { askModel, extractJson } from '../aiConnection.js'

function reply(body, status = 200) {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
}

afterEach(() => vi.unstubAllGlobals())

describe('ai connection', () => {
  it('calls Claude with the player key, straight from the browser', async () => {
    const fetchMock = reply({ content: [{ type: 'text', text: '{"ok":true}' }] })
    vi.stubGlobal('fetch', fetchMock)
    const text = await askModel({ provider: 'anthropic', apiKey: 'sk-ant-x', model: '' }, 'Hi as JSON')
    expect(text).toBe('{"ok":true}')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant-x')
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(JSON.parse(init.body).model).toBe('claude-sonnet-5-5')
  })

  it('calls ChatGPT with a bearer key and JSON mode', async () => {
    const fetchMock = reply({ choices: [{ message: { content: '{"suggestions":[]}' } }] })
    vi.stubGlobal('fetch', fetchMock)
    await askModel({ provider: 'openai', apiKey: 'sk-y', model: 'gpt-4o-mini' }, 'Reply as JSON')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.authorization).toBe('Bearer sk-y')
    expect(JSON.parse(init.body).response_format).toEqual({ type: 'json_object' })
  })

  it('explains a rejected key', async () => {
    vi.stubGlobal('fetch', reply({ error: { message: 'invalid x-api-key' } }, 401))
    await expect(askModel({ provider: 'anthropic', apiKey: 'bad' }, 'x')).rejects.toThrow(/didn’t accept that API key/)
  })

  it('pulls JSON out of fenced or chatty replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Sure! {"suggestions":[]} Enjoy.')).toEqual({ suggestions: [] })
    expect(() => extractJson('no json here')).toThrow(/unexpected format/)
  })
})
