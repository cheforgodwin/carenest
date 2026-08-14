import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { I18nContext } from './I18nContextStore.js'
import { defaultLocale, localeStorageKey, supportedLocales, staticEnglishMessages, translationKeys } from './translationData.js'
import { detectSystemLocale, translateText, translateMessages, getCachedTranslations } from './translationService.js'

function getInitialLocale() {
  if (typeof window === 'undefined') return defaultLocale
  const stored = window.localStorage.getItem(localeStorageKey)
  if (stored && supportedLocales.includes(stored)) return stored
  return detectSystemLocale()
}

function getInitialTranslations(locale) {
  if (typeof window === 'undefined') return {}
  if (locale === 'en') return {}
  return { [locale]: getCachedTranslations(locale) }
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale)
  const [translations, setTranslations] = useState(() => getInitialTranslations(getInitialLocale()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pendingKeys = useRef(new Set())

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale)
  }, [locale])

  const updateLocale = useCallback((nextLocale) => {
    const resolvedLocale = typeof nextLocale === 'function' ? nextLocale(locale) : nextLocale
    if (resolvedLocale !== 'en') {
      const cached = getCachedTranslations(resolvedLocale)
      if (Object.keys(cached).length > 0) {
        setTranslations((current) => ({
          ...current,
          [resolvedLocale]: { ...current[resolvedLocale], ...cached },
        }))
      }
    }
    setLocale(resolvedLocale)
  }, [locale])

  useEffect(() => {
    if (locale === 'en') return
    const missingKeys = translationKeys.filter((key) => !translations[locale]?.[key])
    if (missingKeys.length === 0) return
    if (pendingKeys.current.has('prefetch')) return

    pendingKeys.current.add('prefetch')
    setLoading(true)
    setError('')

    const entries = missingKeys.map((key) => ({ key, text: staticEnglishMessages[key] || key }))

    translateMessages(entries, locale)
      .then((translated) => {
        setTranslations((current) => ({
          ...current,
          [locale]: {
            ...current[locale],
            ...translated,
          },
        }))
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        pendingKeys.current.delete('prefetch')
        setLoading(false)
      })
  }, [locale, translations])

  const translateMessage = useCallback(async (key) => {
    if (locale === 'en') return
    if (translations[locale]?.[key]) return
    if (pendingKeys.current.has(key)) return

    pendingKeys.current.add(key)
    setLoading(true)
    setError('')

    try {
      const sourceText = staticEnglishMessages[key] || key
      const translated = await translateText(key, sourceText, locale)
      setTranslations((current) => ({
        ...current,
        [locale]: {
          ...current[locale],
          [key]: translated,
        },
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      pendingKeys.current.delete(key)
      setLoading(false)
    }
  }, [locale, translations])

  const dictionary = useMemo(() => ({ ...staticEnglishMessages, ...(translations[locale] || {}) }), [locale, translations])

  const contextValue = useMemo(() => ({
    locale,
    setLocale: updateLocale,
    supportedLocales,
    translateMessage,
    dictionary,
    translations,
    loading,
    error,
  }), [locale, updateLocale, translateMessage, dictionary, loading, error, translations])

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

