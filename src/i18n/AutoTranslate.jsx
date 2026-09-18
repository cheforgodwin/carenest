import { useEffect, useMemo, useState } from 'react'
import { uiEnglishText } from './uiTextCatalog.js'
import { translateMessages } from './translationService.js'

const translatedAttributes = ['placeholder', 'title', 'aria-label']
const dynamicPatterns = [
  [/^(\d+) jobs waiting for pickup$/, '$1 courses attendent d’être récupérées'],
  [/^(\d+) jobs currently in your route$/, '$1 courses sont actuellement sur votre itinéraire'],
  [/^(\d+) finished jobs$/, '$1 courses terminées'],
  [/^(\d+) service requests in the system$/, '$1 demandes de service dans le système'],
  [/^Delivery (.+) assigned to you\.$/, 'La livraison $1 vous a été attribuée.'],
  [/^(.+) assigned to you\.$/, '$1 vous a été attribué.'],
  [/^(.+) moved to (.+)\.$/, '$1 est passé au statut $2.'],
  [/^(.+) marked (.+)\.$/, '$1 a été marqué comme $2.'],
  [/^(.+) payment marked as (.+)\.$/, 'Le paiement de $1 a été marqué comme $2.'],
  [/^(.+) provider payout marked as (.+)\.$/, 'Le paiement du prestataire pour $1 a été marqué comme $2.'],
  [/^(.+) is back in pending jobs\.$/, '$1 est de nouveau parmi les tâches en attente.'],
  [/^Application submitted\. CareNest will review it before (provider|rider) access is enabled\.$/, 'Candidature envoyée. CareNest l’examinera avant d’activer l’accès $1.'],
]

function replaceDynamicText(text, locale) {
  if (locale !== 'fr') return text
  const trimmed = text.trim()
  for (const [pattern, replacement] of dynamicPatterns) {
    if (pattern.test(trimmed)) return text.replace(trimmed, trimmed.replace(pattern, replacement))
  }
  return text
}

function replaceText(text, translations, locale) {
  const trimmed = text.trim()
  const replacement = translations.get(trimmed)
  if (replacement) return text.replace(trimmed, replacement)
  return replaceDynamicText(text, locale)
}

function translateDocument(root, translations, locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  nodes.forEach((node) => {
    if (node.parentElement?.closest('[data-no-translate], script, style, code, pre')) return
    const nextText = replaceText(node.nodeValue || '', translations, locale)
    if (nextText !== node.nodeValue) node.nodeValue = nextText
  })

  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((element) => {
    if (element.closest('[data-no-translate]')) return
    translatedAttributes.forEach((attribute) => {
      const value = element.getAttribute(attribute)
      const replacement = value && translations.get(value.trim())
      if (replacement) element.setAttribute(attribute, replacement)
    })
  })

  if (locale === 'fr') {
    root.querySelectorAll?.('.dashboard-error, .auth-status.error, .request-status.error').forEach((element) => {
      const current = element.textContent?.trim()
      if (current && !translations.has(current) && !/[À-ÿ]/.test(current)) {
        element.textContent = 'Une erreur est survenue. Vérifiez les informations saisies et réessayez.'
      }
    })
  }
}

export default function AutoTranslate({ locale }) {
  const [french, setFrench] = useState({})
  const translations = useMemo(() => new Map(
    uiEnglishText.map((text, index) => [locale === 'fr' ? text : french[index], locale === 'fr' ? french[index] : text]),
  ), [locale, french])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (locale !== 'fr' || Object.keys(french).length) return
    translateMessages(uiEnglishText.map((text, index) => ({ key: `ui.${index}`, text })), 'fr')
      .then((result) => setFrench(Object.fromEntries(uiEnglishText.map((_, index) => [index, result[`ui.${index}`]]))))
      .catch(() => {})
  }, [locale, french])

  useEffect(() => {
    if (!translations.size || (locale === 'fr' && !Object.keys(french).length)) return undefined
    const apply = () => translateDocument(document.body, translations, locale)
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { attributes: true, attributeFilter: translatedAttributes, characterData: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [locale, french, translations])

  return null
}
