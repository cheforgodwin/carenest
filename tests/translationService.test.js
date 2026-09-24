import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { translateText, translateMessages, getBrowserLocale } from '../src/i18n/translationService.js'

const originalFetch = globalThis.fetch
const originalLocalStorage = globalThis.localStorage
const originalNavigator = globalThis.navigator

function mockLocalStorage() {
  let store = {}
  return {
    getItem(key) {
      return store[key] ?? null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
}

describe('translationService', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: mockLocalStorage(),
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { languages: ['fr-FR'], language: 'fr-FR' },
    })
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('caches translations in localStorage', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translations: ['Bonjour'] }),
    })

    const result = await translateText('hello.greeting', 'Hello', 'fr')
    expect(result).toBe('Bonjour')
    const cacheEntry = JSON.parse(globalThis.localStorage.getItem('carenest_translation_cache_v4'))
    expect(cacheEntry['fr::hello.greeting']).toBe('Bonjour')

    const second = await translateText('hello.greeting', 'Hello', 'fr')
    expect(second).toBe('Bonjour')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('detects browser locale', () => {
    expect(getBrowserLocale()).toBe('fr')
  })
})


describe('translation batch recovery', () => {
  it('keeps completed batches when a later request fails', async () => {
    const storage = mockLocalStorage()
    vi.stubGlobal('localStorage', storage)
    const entries = Array.from({ length: 51 }, (_, i) => ({ key: 'batch.' + i, text: 'Label ' + i }))
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ translations: entries.slice(0, 50).map((_, i) => 'French ' + i) }) }).mockRejectedValueOnce(new Error('Offline'))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await expect(translateMessages(entries, 'fr')).rejects.toThrow('Offline')
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ translations: ['French 50'] }) })
      const result = await translateMessages(entries, 'fr')
      expect(result['batch.0']).toBe('French 0')
      expect(result['batch.50']).toBe('French 50')
      expect(JSON.parse(fetchMock.mock.calls[2][1].body).texts).toEqual(['Label 50'])
    } finally { vi.unstubAllGlobals() }
  })
})
