import { getAdminDb } from './_firebaseAdmin.js'
import { applyVerifiedPayment, fetchVerifiedPayment } from './_paymentVerification.js'
import { handleCors } from './_cors.js'

const webhookLimits = globalThis.__careNestWebhookLimits || new Map()
globalThis.__careNestWebhookLimits = webhookLimits

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function enforceRateLimit(req) {
  const address = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
  const now = Date.now()
  const state = webhookLimits.get(address)
  if (!state || now - state.startedAt >= 60_000) webhookLimits.set(address, { startedAt: now, count: 1 })
  else if (state.count >= 60) return false
  else state.count += 1
  return true
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })

  if (!enforceRateLimit(req)) return sendJson(res, 429, { error: 'Too many webhook requests.' })

  try {
    const callback = req.body || {}
    const callbackTransactionId = String(callback.transId || callback.transactionId || '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(callbackTransactionId)) return sendJson(res, 400, { error: 'Invalid Fapshi transaction ID.' })

    const payment = await fetchVerifiedPayment(callbackTransactionId)
    const result = await applyVerifiedPayment(getAdminDb(), payment, 'fapshi-webhook')
    return sendJson(res, 200, result)
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to verify Fapshi payment.' })
  }
}
