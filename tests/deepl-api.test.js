import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/translate.js'

const originalFetch = globalThis.fetch

function createResponse() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

describe('DeepL translation API', () => {
  beforeEach(() => {
    process.env.DEEPL_API_KEY = 'server-only-test-key:fx'
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.DEEPL_API_KEY
  })

  it('uses the free endpoint and server-side authorization', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translations: [{ text: 'Bonjour' }] }),
    })
    const req = { method: 'POST', headers: { 'x-forwarded-for': 'test-one' }, body: { texts: ['Hello'], sourceLocale: 'en', targetLocale: 'fr' } }
    const res = createResponse()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ translations: ['Bonjour'] })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api-free.deepl.com/v2/translate',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'DeepL-Auth-Key server-only-test-key:fx' }) }),
    )
  })

  it('rejects unsupported languages without contacting DeepL', async () => {
    const req = { method: 'POST', headers: { 'x-forwarded-for': 'test-two' }, body: { texts: ['Hello'], sourceLocale: 'en', targetLocale: 'de' } }
    const res = createResponse()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
