import { useContext, useEffect } from 'react'
import { I18nContext } from './I18nContextStore.js'

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
