import { translationCacheKey, supportedLocales } from './translationData.js'

const TRANSLATION_ENDPOINT = '/api/translate'
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
    // Translation still works if a browser denies or exhausts local storage.
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
    if (cachedLocale === normalized && messageKey) translations[messageKey] = value
    return translations
  }, {})
}

export async function translateMessages(entries, targetLocale) {
  const locale = getTargetLocale(targetLocale)
  if (locale === 'en') return entries.reduce((result, entry) => ({ ...result, [entry.key]: entry.text }), {})

  const cache = getStoredCache()
  const result = {}
  const missingEntries = []
  entries.forEach((entry) => {
    const cacheKey = `${locale}::${entry.key}`
    if (cache[cacheKey]) result[entry.key] = cache[cacheKey]
    else missingEntries.push(entry)
  })
  if (!missingEntries.length) return result

  for (let offset = 0; offset < missingEntries.length; offset += 50) {
    const batch = missingEntries.slice(offset, offset + 50)
    const response = await fetch(TRANSLATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: batch.map((entry) => entry.text),
        sourceLocale: 'en',
        targetLocale: locale,
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error || 'Translation request failed.')

    const translations = Array.isArray(data?.translations) ? data.translations : []
    if (translations.length !== batch.length) throw new Error('Translation response was incomplete.')
    batch.forEach((entry, index) => {
      const translatedText = String(translations[index] || '')
      if (translatedText) {
        cache[`${locale}::${entry.key}`] = translatedText
        result[entry.key] = translatedText
      }
    })
  }
  setStoredCache(cache)
  return result
}

export async function translateText(messageKey, text, targetLocale) {
  const entries = await translateMessages([{ key: messageKey, text }], targetLocale)
  return entries[messageKey]
}

export function getBrowserLocale() {
  const nav = getNavigator()
  const locale = nav.languages?.[0] || nav.language || nav.userLanguage || 'en'
  return getTargetLocale(locale)
}

export function detectSystemLocale() {
  return getBrowserLocale()
}
