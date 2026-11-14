import { timingSafeEqual } from 'node:crypto'
import { getAdminDb } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { getFapshiPayoutConfig } from './_fapshiPayout.js'
import { verifyPayoutWebhookTransaction } from './_payoutVerification.js'

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function validWebhookSecret(expected, supplied) {
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length > 0 && expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })

  try {
    const config = getFapshiPayoutConfig()
    if (!config.webhookSecret) return send(res, 503, { error: 'Payout webhook verification is not configured.' })
    const suppliedSecret = String(req.headers?.['x-wh-secret'] || '')
    if (!validWebhookSecret(config.webhookSecret, suppliedSecret)) return send(res, 401, { error: 'Invalid webhook credentials.' })

    const transactionId = String(req.body?.transId || req.body?.transactionId || '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) return send(res, 400, { error: 'Invalid Fapshi transaction ID.' })
    const result = await verifyPayoutWebhookTransaction(getAdminDb(), transactionId)
    return send(res, 200, result)
  } catch (error) {
    return send(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Unable to verify the Fapshi payout notification.',
    })
  }
}