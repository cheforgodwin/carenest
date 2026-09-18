import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/translate.js'

const originalFetch = globalThis.fetch

describe('CareNest brand translation protection', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.DEEPL_API_KEY
  })

  it('marks CareNest as ignored XML and removes the marker from the response', async () => {
    process.env.DEEPL_API_KEY = 'server-only-test-key:fx'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: 'Bienvenue chez <brand>CareNest</brand>' }] }),
    })
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': 'brand-test' },
      body: { texts: ['Welcome to CareNest'], sourceLocale: 'en', targetLocale: 'fr' },
    }
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
    }

    await handler(req, res)

    const request = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(request).toMatchObject({
      text: ['Welcome to <brand>CareNest</brand>'],
      tag_handling: 'xml',
      ignore_tags: ['brand'],
    })
    expect(res.body.translations).toEqual(['Bienvenue chez CareNest'])
  })
})
