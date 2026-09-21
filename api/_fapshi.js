function configurationError(message) {
  return Object.assign(new Error(message), { code: 'PAYMENT_CONFIGURATION_ERROR', statusCode: 503 })
}

export function getFapshiConfig() {
  const mode = String(process.env.FAPSHI_MODE || 'sandbox').trim().toLowerCase()
  if (!['sandbox', 'live'].includes(mode)) throw configurationError('FAPSHI_MODE must be sandbox or live.')
  const prefix = mode === 'live' ? 'FAPSHI_LIVE' : 'FAPSHI_SANDBOX'
  const origin = mode === 'live' ? 'https://live.fapshi.com' : 'https://sandbox.fapshi.com'
  const configuredUrl = String(process.env[prefix + '_API_URL'] || origin + '/initiate-pay').trim()
  let url
  try { url = new URL(configuredUrl) } catch { throw configurationError('Invalid Fapshi API URL.') }
  if (url.origin !== origin || url.username || url.password || url.search || url.hash || !['/', '/initiate-pay', '/initiate-pay/'].includes(url.pathname)) {
    throw configurationError('Fapshi API URL does not match the selected payment environment.')
  }
  const apiUser = String(process.env[prefix + '_API_USER'] || '').trim()
  const apiKey = String(process.env[prefix + '_SECRET_KEY'] || '').trim()
  if ([apiUser, apiKey].some((value) => !value || /^(your[-_]|replace|change[-_]?me|<)/i.test(value) || /[\s"']/.test(value))) {
    throw configurationError('Fapshi credentials are missing or contain placeholder values.')
  }
  return { apiUrl: origin + '/initiate-pay', apiUser, apiKey }
}

export const getFapshiBaseUrl = (url) => url.replace(/\/initiate-pay\/?$/, '').replace(/\/$/, '')

export async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text } }
}
