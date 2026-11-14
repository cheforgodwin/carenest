import { readJsonResponse } from './_fapshi.js'

function configurationError(message) {
  return Object.assign(new Error(message), { code: 'PAYOUT_CONFIGURATION_ERROR', statusCode: 503 })
}

export function getFapshiPayoutConfig({ allowUnapprovedLive = false } = {}) {
  const mode = String(process.env.FAPSHI_PAYOUT_MODE || 'sandbox').trim().toLowerCase()
  if (!['sandbox', 'live'].includes(mode)) throw configurationError('FAPSHI_PAYOUT_MODE must be sandbox or live.')
  if (mode === 'live' && !allowUnapprovedLive
    && String(process.env.FAPSHI_PAYOUT_LIVE_ENABLED || '').trim().toLowerCase() !== 'true') {
    throw configurationError('Live payouts are locked until Fapshi enables the payout service.')
  }

  const prefix = mode === 'live' ? 'FAPSHI_PAYOUT_LIVE' : 'FAPSHI_PAYOUT_SANDBOX'
  const origin = mode === 'live' ? 'https://live.fapshi.com' : 'https://sandbox.fapshi.com'
  const apiUser = String(process.env[prefix + '_API_USER'] || '').trim()
  const apiKey = String(process.env[prefix + '_SECRET_KEY'] || '').trim()
  if ([apiUser, apiKey].some((value) => !value || /^(your[-_]|replace|change[-_]?me|<)/i.test(value) || /[\s"']/.test(value))) {
    throw configurationError('Fapshi payout credentials are missing or contain placeholder values.')
  }

  return {
    mode,
    origin,
    apiUser,
    apiKey,
    webhookSecret: String(process.env[prefix + '_WEBHOOK_SECRET'] || '').trim(),
  }
}

export async function fapshiPayoutRequest(path, { method = 'GET', body, allowUnapprovedLive = false } = {}) {
  const config = getFapshiPayoutConfig({ allowUnapprovedLive })
  if (!(path === '/balance' || path === '/payout'
    || path.startsWith('/payment-status/') || path.startsWith('/transaction/'))) {
    throw configurationError('Unsupported Fapshi payout API path.')
  }
  const response = await fetch(config.origin + path, {
    method,
    headers: {
      apiuser: config.apiUser,
      apikey: config.apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(method === 'POST' ? 20000 : 15000),
  })
  return { response, result: await readJsonResponse(response), config }
}