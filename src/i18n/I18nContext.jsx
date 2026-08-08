import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { defaultLocale, localeStorageKey, supportedLocales, staticEnglishMessages } from './translationData.js'
import { detectSystemLocale, translateText } from './translationService.js'

const I18nContext = createContext(null)

function getInitialLocale() {
  if (typeof window === 'undefined') return defaultLocale
  const stored = window.localStorage.getItem(localeStorageKey)
  if (stored && supportedLocales.includes(stored)) return stored
  return detectSystemLocale()
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale)
  const [translations, setTranslations] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pendingKeys = useRef(new Set())

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale)
  }, [locale])

  const translateMessage = useCallback(async (key) => {
    if (locale === 'en') return
    if (translations[locale]?.[key]) return
    if (pendingKeys.current.has(key)) return

    pendingKeys.current.add(key)
    setLoading(true)
    setError('')

    try {
      const sourceText = staticEnglishMessages[key] || key
      const translated = await translateText(sourceText, locale)
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
    setLocale,
    supportedLocales,
    translateMessage,
    dictionary,
    loading,
    error,
  }), [locale, supportedLocales, translateMessage, dictionary, loading, error])

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export function useT(key) {
  const { locale, dictionary, translateMessage } = useI18n()

  useEffect(() => {
    if (locale === 'en') return
    if (dictionary[key]) return
    translateMessage(key)
  }, [locale, key, dictionary, translateMessage])

  return dictionary[key] || key
}
