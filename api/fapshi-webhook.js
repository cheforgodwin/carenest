import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from './_firebaseAdmin.js'
import { getFapshiBaseUrl, getFapshiConfig, readJsonResponse } from './_fapshi.js'
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

async function verifyWithFapshi(transactionId) {
  const { apiUrl, apiUser, apiKey } = getFapshiConfig()
  const response = await fetch(getFapshiBaseUrl(apiUrl) + '/payment-status/' + encodeURIComponent(transactionId), {
    headers: { apiuser: apiUser, apikey: apiKey },
  })
  const payment = await readJsonResponse(response)
  if (!response.ok) throw new Error(payment.message || 'Fapshi status lookup failed.')
  return payment
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })

  if (!enforceRateLimit(req)) return sendJson(res, 429, { error: 'Too many webhook requests.' })

  try {
    const callback = req.body || {}
    const callbackTransactionId = String(callback.transId || callback.transactionId || '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(callbackTransactionId)) return sendJson(res, 400, { error: 'Invalid Fapshi transaction ID.' })

    const payment = await verifyWithFapshi(callbackTransactionId)
    const verifiedTransactionId = String(payment.transId || payment.transactionId || '').trim()
    if (!verifiedTransactionId || verifiedTransactionId !== callbackTransactionId) {
      return sendJson(res, 400, { error: 'Transaction verification mismatch.' })
    }

    const expectedWebhook = String(process.env.FAPSHI_WEBHOOK_URL || '').trim().replace(/\/$/, '')
    const verifiedWebhook = String(payment.webhook || '').trim().replace(/\/$/, '')
    if (expectedWebhook && verifiedWebhook && verifiedWebhook !== expectedWebhook) {
      return sendJson(res, 400, { error: 'Payment belongs to a different webhook.' })
    }

    const providerStatus = String(payment.status || '').toUpperCase()
    if (!['SUCCESSFUL', 'FAILED', 'EXPIRED'].includes(providerStatus)) {
      return sendJson(res, 202, { received: true, status: providerStatus || 'PENDING' })
    }

    const firestoreId = String(payment.externalId || '').trim()
    if (!firestoreId || firestoreId.includes('/')) return sendJson(res, 400, { error: 'Invalid CareNest order binding.' })

    const db = getAdminDb()
    const orderRef = db.collection('serviceRequests').doc(firestoreId)
    const snapshot = await orderRef.get()
    if (!snapshot.exists) return sendJson(res, 404, { error: 'Matching CareNest order not found.' })

    const order = snapshot.data()
    if (String(order.paymentReference || '') !== verifiedTransactionId
      || String(order.paymentReceiptTransactionId || '') !== verifiedTransactionId
      || String(payment.userId || '') !== String(order.customerUid || '')
      || Number(order.amount) !== Number(payment.amount)) {
      return sendJson(res, 400, { error: 'Payment does not match the bound order.' })
    }

    const paymentStatus = providerStatus === 'SUCCESSFUL' ? 'Paid' : 'Failed'
    if (order.paymentStatus === 'Paid' && paymentStatus !== 'Paid') {
      return sendJson(res, 409, { error: 'A confirmed payment cannot be downgraded.' })
    }

    await orderRef.update({
      paymentStatus,
      paymentProviderStatus: providerStatus,
      paymentConfirmedAt: payment.dateConfirmed || null,
      paymentVerifiedAt: FieldValue.serverTimestamp(),
      paymentVerifiedBy: 'fapshi-webhook',
      paymentWebhookReceivedAt: FieldValue.serverTimestamp(),
      paidAt: paymentStatus === 'Paid' ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return sendJson(res, 200, { received: true, orderId: order.id || firestoreId, paymentStatus })
  } catch {
    return sendJson(res, 500, { error: 'Unable to verify Fapshi payment.' })
  }
}
