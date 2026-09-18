export function getFapshiConfig() {
  const mode = String(process.env.FAPSHI_MODE || 'sandbox').trim().toLowerCase()
  if (!['sandbox', 'live'].includes(mode)) throw new Error('FAPSHI_MODE must be sandbox or live.')
  const apiUrl = mode === 'live' ? String(process.env.FAPSHI_LIVE_API_URL || '').trim() : String(process.env.FAPSHI_SANDBOX_API_URL || '').trim()
  const apiUser = mode === 'live' ? String(process.env.FAPSHI_LIVE_API_USER || '').trim() : String(process.env.FAPSHI_SANDBOX_API_USER || '').trim()
  const apiKey = mode === 'live' ? String(process.env.FAPSHI_LIVE_SECRET_KEY || '').trim() : String(process.env.FAPSHI_SANDBOX_SECRET_KEY || '').trim()
  if (!apiUrl || !apiUser || !apiKey) throw new Error('Missing Fapshi configuration.')
  return { apiUrl, apiUser, apiKey }
}

export const getFapshiBaseUrl = (url) => url.replace(/\/initiate-pay\/?$/, '').replace(/\/$/, '')

export async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text } }
}
