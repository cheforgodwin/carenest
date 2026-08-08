import { translationCacheKey, supportedLocales } from './translationData.js'

const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'
const localePattern = /^([a-z]{2})(?:-[A-Z]{2})?$/

function getStoredCache() {
  try {
    const raw = window.localStorage.getItem(translationCacheKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setStoredCache(cache) {
  try {
    window.localStorage.setItem(translationCacheKey, JSON.stringify(cache))
  } catch {
    // ignore storage errors
  }
}

function getTargetLocale(locale) {
  const normalized = localePattern.exec(locale)?.[1] || locale
  return supportedLocales.includes(normalized) ? normalized : 'en'
}

export async function translateText(text, targetLocale) {
  const locale = getTargetLocale(targetLocale)
  if (locale === 'en') return text

  const cache = getStoredCache()
  const cacheKey = `${locale}::${text}`
  if (cache[cacheKey]) return cache[cacheKey]

  const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_TRANSLATION_API_KEY
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
  const nav = window.navigator
  const locale = nav.languages?.[0] || nav.language || nav.userLanguage || 'en'
  return getTargetLocale(locale)
}

export function detectSystemLocale() {
  return getBrowserLocale()
}
