import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { timingSafeEqual } from 'node:crypto'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function isExpectedSecret(received, expected) {
  if (!received || !expected) return false
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

function getDb() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!rawServiceAccount) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON.')
  const serviceAccount = JSON.parse(rawServiceAccount)
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) })
  return getFirestore(app)
}

async function verifyWithFapshi(transactionId) {
  const mode = String(process.env.FAPSHI_MODE || 'sandbox').trim()
  const apiUrl = mode === 'live'
    ? String(process.env.FAPSHI_LIVE_API_URL || '').trim()
    : String(process.env.FAPSHI_SANDBOX_API_URL || '').trim()
  const apiUser = mode === 'live'
    ? String(process.env.FAPSHI_LIVE_API_USER || '').trim()
    : String(process.env.FAPSHI_SANDBOX_API_USER || '').trim()
  const apiKey = mode === 'live'
    ? String(process.env.FAPSHI_LIVE_SECRET_KEY || '').trim()
    : String(process.env.FAPSHI_SANDBOX_SECRET_KEY || '').trim()

  if (!apiUrl || !apiUser || !apiKey) throw new Error('Missing Fapshi API configuration.')
  const statusUrl = `${apiUrl.replace(/\/initiate-pay\/?$/, '').replace(/\/$/, '')}/payment-status/${encodeURIComponent(transactionId)}`
  const response = await fetch(statusUrl, { headers: { apiuser: apiUser, apikey: apiKey } })
  const text = await response.text()
  let payment = {}
  try { payment = text ? JSON.parse(text) : {} } catch { payment = { message: text } }
  if (!response.ok) throw new Error(payment.message || `Fapshi status lookup failed (${response.status}).`)
  return payment
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })

  const expectedSecret = String(process.env.FAPSHI_WEBHOOK_SECRET || '')
  const receivedSecret = String(req.headers['x-wh-secret'] || '')
  if (!isExpectedSecret(receivedSecret, expectedSecret)) return sendJson(res, 401, { error: 'Invalid webhook secret.' })

  try {
    const webhookPayment = req.body || {}
    const transId = String(webhookPayment.transId || '')
    if (!transId) return sendJson(res, 400, { error: 'Missing Fapshi transaction ID.' })

    const payment = await verifyWithFapshi(transId)
    if (!['SUCCESSFUL', 'FAILED', 'EXPIRED'].includes(payment.status)) {
      return sendJson(res, 202, { received: true, status: payment.status || 'PENDING' })
    }

    const orderId = String(payment.externalId || webhookPayment.externalId || '')
    if (!orderId) return sendJson(res, 400, { error: 'Missing CareNest order ID.' })

    const db = getDb()
    const snapshot = await db.collection('serviceRequests').where('id', '==', orderId).limit(1).get()
    if (snapshot.empty) return sendJson(res, 404, { error: 'Matching CareNest order not found.' })

    const order = snapshot.docs[0]
    if (Number(order.data().amount) !== Number(payment.amount)) {
      return sendJson(res, 400, { error: 'Payment amount does not match the order.' })
    }

    const paymentStatus = payment.status === 'SUCCESSFUL' ? 'Paid' : 'Failed'
    await order.ref.update({
      paymentStatus,
      paymentReference: payment.transId || transId,
      paymentReceiptTransactionId: payment.transId || transId,
      paymentProviderStatus: payment.status,
      paymentProvider: 'Fapshi',
      paymentConfirmedAt: payment.dateConfirmed || null,
      paymentVerifiedAt: FieldValue.serverTimestamp(),
      paymentVerifiedBy: 'fapshi-webhook',
      paymentWebhookReceivedAt: FieldValue.serverTimestamp(),
      paymentReceiptText: payment.message || webhookPayment.message || `Fapshi ${payment.status}`,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return sendJson(res, 200, { received: true, orderId, paymentStatus })
  } catch (error) {
    return sendJson(res, 500, { error: 'Unable to verify Fapshi payment.', details: String(error.message || error) })
  }
}
