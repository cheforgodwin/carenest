import { handleCors } from './_cors.js'
const supportedLocales = new Set(['en', 'fr'])
const limits = globalThis.__careNestTranslationLimits || new Map()
const cache = globalThis.__careNestTranslationCache || new Map()
const brandCacheVersion = 'brand-v1'
globalThis.__careNestTranslationLimits = limits
globalThis.__careNestTranslationCache = cache

function setupResponse(res) {
  if (!res.status) res.status = function (code) { this.statusCode = code; return this }
  if (!res.json) res.json = function (body) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8')
    this.end(JSON.stringify(body))
    return this
  }
}

function reject(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  throw error
}

function enforceRateLimit(req) {
  const address = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
  const now = Date.now()
  const state = limits.get(address)
  if (!state || now - state.startedAt >= 60_000) {
    limits.set(address, { startedAt: now, count: 1 })
  } else if (state.count >= 30) {
    reject('Too many translation requests. Please wait one minute.', 429)
  } else {
    state.count += 1
  }
}

function validate(body) {
  const sourceLocale = String(body?.sourceLocale || '').toLowerCase()
  const targetLocale = String(body?.targetLocale || '').toLowerCase()
  const texts = Array.isArray(body?.texts) ? body.texts.map((text) => String(text || '').trim()) : []
  if (!supportedLocales.has(sourceLocale) || !supportedLocales.has(targetLocale) || sourceLocale === targetLocale) {
    reject('Only English and French translation is supported.', 400)
  }
  if (!texts.length || texts.length > 50 || texts.some((text) => !text || text.length > 1000)) {
    reject('Provide between 1 and 50 valid text values.', 400)
  }
  if (texts.reduce((total, text) => total + text.length, 0) > 12_000) reject('Translation text is too large.', 400)
  return { sourceLocale, targetLocale, texts }
}

export default async function handler(req, res) {
  setupResponse(res)
  if (handleCors(req, res)) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    enforceRateLimit(req)
    const { sourceLocale, targetLocale, texts } = validate(req.body)
    const apiKey = String(process.env.DEEPL_API_KEY || '').trim()
    if (!apiKey) return res.status(503).json({ error: 'Translation service is not configured.' })

    const results = new Array(texts.length)
    const missing = []
    texts.forEach((text, index) => {
      const key = `${brandCacheVersion}::${sourceLocale}::${targetLocale}::${text}`
      if (cache.has(key)) results[index] = cache.get(key)
      else missing.push({ text, index, key })
    })

    if (missing.length) {
      const configuredUrl = String(process.env.DEEPL_API_URL || '').trim()
      const baseUrl = (configuredUrl || (apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com')).replace(/\/$/, '')
      const upstream = await fetch(`${baseUrl}/v2/translate`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
        headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: missing.map((item) => item.text.replace(/\bCareNest\b/g, '<brand>CareNest</brand>')),
          source_lang: sourceLocale.toUpperCase(),
          target_lang: targetLocale.toUpperCase(),
          preserve_formatting: true,
          tag_handling: 'xml',
          ignore_tags: ['brand'],
        }),
      })
      const data = await upstream.json().catch(() => null)
      if (!upstream.ok) {
        console.error('translation_provider_rejected', { status: upstream.status })
        reject('DeepL translation request failed.', upstream.status === 429 ? 429 : 502)
      }
      if (data?.translations?.length !== missing.length) throw new Error('Incomplete DeepL response.')

      missing.forEach((item, index) => {
        const translated = String(data.translations[index]?.text || '').replace(/<\/?brand>/g, '')
        if (!translated) throw new Error('Empty DeepL translation.')
        results[item.index] = translated
        cache.set(item.key, translated)
      })
      while (cache.size > 1000) cache.delete(cache.keys().next().value)
    }

    return res.status(200).json({ translations: results })
  } catch (error) {
    const status = Number(error.statusCode || 500)
    return res.status(status).json({ error: status < 500 ? error.message : 'Translation is temporarily unavailable.' })
  }
}
