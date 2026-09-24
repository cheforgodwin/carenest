import { useEffect, useRef } from 'react'
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
      if (replacement && replacement !== value) element.setAttribute(attribute, replacement)
    })
  })


}

// Only catalogued interface labels are sent; customer names and order data stay local.
const catalog = new Set(uiEnglishText)
export default function AutoTranslate({ locale }) {
  const french = useRef(new Map())
  useEffect(() => {
    document.documentElement.lang = locale
    let stopped = false
    let busy = false
    let timer
    let failures = 0
    const apply = () => {
      const translations = locale === 'fr' ? french.current : new Map([...french.current].map(([en, fr]) => [fr, en]))
      translateDocument(document.body, translations, locale)
    }
    const scan = async () => {
      if (stopped) return
      apply()
      if (locale !== 'fr' || busy) return
      const needed = new Set()
      const add = (value) => {
        const text = String(value || '').trim()
        if (catalog.has(text) && !french.current.has(text)) needed.add(text)
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        if (!walker.currentNode.parentElement?.closest('[data-no-translate], script, style, code, pre')) add(walker.currentNode.nodeValue)
      }
      document.body.querySelectorAll('[placeholder], [title], [aria-label]').forEach((element) => {
        if (!element.closest('[data-no-translate]')) translatedAttributes.forEach((attribute) => add(element.getAttribute(attribute)))
      })
      if (!needed.size || failures >= 3) return
      busy = true
      try {
        const entries = [...needed].slice(0, 50).map((text) => ({ key: 'ui.text.' + encodeURIComponent(text), text }))
        const result = await translateMessages(entries, 'fr')
        entries.forEach(({ key, text }) => { if (result[key]) french.current.set(text, result[key]) })
        failures = 0
      } catch {
        failures++
      } finally {
        busy = false
        if (!stopped) { apply(); timer = setTimeout(scan, failures ? failures * 5000 : 100) }
      }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 150) }
    const retry = () => { failures = 0; schedule() }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { attributes: true, attributeFilter: translatedAttributes, characterData: true, childList: true, subtree: true })
    window.addEventListener('online', retry)
    scan()
    return () => { stopped = true; clearTimeout(timer); observer.disconnect(); window.removeEventListener('online', retry) }
  }, [locale])
  return null
}
