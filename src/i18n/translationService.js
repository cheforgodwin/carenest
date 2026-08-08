import { translationCacheKey, supportedLocales } from './translationData.js'

const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'
const localePattern = /^([a-z]{2})(?:-[A-Z]{2})?$/

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  if (globalThis.localStorage) return globalThis.localStorage
  throw new Error('localStorage is not available')
}

function getNavigator() {
  if (typeof window !== 'undefined' && window.navigator) return window.navigator
  if (globalThis.navigator) return globalThis.navigator
  throw new Error('Navigator is not available')
}

export function getStoredCache() {
  try {
    const raw = getStorage().getItem(translationCacheKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setStoredCache(cache) {
  try {
    getStorage().setItem(translationCacheKey, JSON.stringify(cache))
  } catch {
    // ignore storage errors
  }
}

function getTargetLocale(locale) {
  const normalized = localePattern.exec(locale)?.[1] || locale
  return supportedLocales.includes(normalized) ? normalized : 'en'
}

export function getCachedTranslations(locale) {
  const normalized = getTargetLocale(locale)
  const cache = getStoredCache()
  return Object.entries(cache).reduce((translations, [cacheKey, value]) => {
    const [cachedLocale, messageKey] = cacheKey.split('::')
    if (cachedLocale === normalized && messageKey) {
      translations[messageKey] = value
    }
    return translations
  }, {})
}

export async function translateMessages(entries, targetLocale) {
  const locale = getTargetLocale(targetLocale)
  if (locale === 'en') {
    return entries.reduce((result, entry) => ({ ...result, [entry.key]: entry.text }), {})
  }

  const cache = getStoredCache()
  const result = {}
  const missingEntries = []

  entries.forEach((entry) => {
    const cacheKey = `${locale}::${entry.key}`
    if (cache[cacheKey]) {
      result[entry.key] = cache[cacheKey]
    } else {
      missingEntries.push(entry)
    }
  })

  if (missingEntries.length === 0) return result

  const apiKey = import.meta?.env?.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY || (typeof process !== 'undefined' && process?.env?.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY)
  if (!apiKey) {
    throw new Error('Missing VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY')
  }

  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: missingEntries.map((entry) => entry.text),
      source: 'en',
      target: locale,
      format: 'text',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error?.message || 'Google Translate API request failed')
  }

  const data = await response.json()
  const translations = data?.data?.translations || []

  missingEntries.forEach((entry, index) => {
    const translatedText = translations[index]?.translatedText
    if (translatedText) {
      const cacheKey = `${locale}::${entry.key}`
      cache[cacheKey] = translatedText
      result[entry.key] = translatedText
    }
  })

  setStoredCache(cache)
  return result
}

export async function translateText(messageKey, text, targetLocale) {
  const entries = await translateMessages([{ key: messageKey, text }], targetLocale)
  return entries[messageKey]

  const apiKey = import.meta?.env?.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY || (typeof process !== 'undefined' && process?.env?.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY)
  if (!apiKey) {
    throw new Error('Missing VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY')
  }

  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'en',
      target: locale,
      format: 'text',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error?.message || 'Google Translate API request failed')
  }

  const data = await response.json()
  const translatedText = data?.data?.translations?.[0]?.translatedText
  if (!translatedText) {
    throw new Error('Translation response could not be parsed')
  }

  cache[cacheKey] = translatedText
  setStoredCache(cache)
  return translatedText
}

export function getBrowserLocale() {
  const nav = getNavigator()
  const locale = nav.languages?.[0] || nav.language || nav.userLanguage || 'en'
  return getTargetLocale(locale)
}

export function detectSystemLocale() {
  return getBrowserLocale()
}
