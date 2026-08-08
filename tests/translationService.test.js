import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { translateText, getBrowserLocale } from '../src/i18n/translationService.js'

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
    process.env.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY = 'test'
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
      json: async () => ({ data: { translations: [{ translatedText: 'Bonjour' }] } }),
    })

    const result = await translateText('Hello', 'fr')
    expect(result).toBe('Bonjour')
    const cacheEntry = JSON.parse(globalThis.localStorage.getItem('carenest_translation_cache_v1'))
    expect(cacheEntry['fr::Hello']).toBe('Bonjour')

    const second = await translateText('Hello', 'fr')
    expect(second).toBe('Bonjour')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('detects browser locale', () => {
    expect(getBrowserLocale()).toBe('fr')
  })
})
