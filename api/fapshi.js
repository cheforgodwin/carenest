import { FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { getFapshiBaseUrl, getFapshiConfig, readJsonResponse } from './_fapshi.js'
import { handleCors } from './_cors.js'

function ensureResponseHelpers(res) {
  if (typeof res.status !== 'function') res.status = function (code) { this.statusCode = code; return this }
  if (typeof res.json !== 'function') res.json = function (payload) {
    this.setHeader('Content-Type', 'application/json')
    this.end(JSON.stringify(payload))
    return this
  }
  return res
}

export default async function handler(req, res) {
  ensureResponseHelpers(res)
  if (handleCors(req, res)) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    const firestoreId = String(req.body?.firestoreId || req.body?.order?.firestoreId || '').trim()
    if (!firestoreId || firestoreId.length > 128 || firestoreId.includes('/')) {
      return res.status(400).json({ error: 'A valid order identifier is required.' })
    }

    const db = getAdminDb()
    const orderRef = db.collection('serviceRequests').doc(firestoreId)
    const snapshot = await orderRef.get()
    if (!snapshot.exists) return res.status(404).json({ error: 'Order not found.' })

    const order = snapshot.data()
    if (order.customerUid !== user.uid) return res.status(403).json({ error: 'You do not own this order.' })
    if (!Number.isInteger(order.amount) || order.amount < 100) return res.status(409).json({ error: 'The order amount is invalid.' })
    if (order.paymentStatus === 'Paid') return res.status(409).json({ error: 'This order has already been paid.' })
    if (order.paymentReference && ['Pending', 'Submitted'].includes(order.paymentStatus)) {
      return res.status(409).json({ error: 'A payment is already in progress for this order.' })
    }

    const phone = String(order.customerPhone || '').replace(/\D/g, '').replace(/^237/, '')
    if (!/^6\d{8}$/.test(phone)) return res.status(400).json({ error: 'The order needs a valid Cameroon Mobile Money number.' })

    const { apiUrl, apiUser, apiKey } = getFapshiConfig()
    const direct = String(process.env.FAPSHI_PAYMENT_FLOW || 'direct').trim().toLowerCase() === 'direct'

    const now = Date.now()
    const rateRef = db.collection('paymentRateLimits').doc(user.uid)
    await db.runTransaction(async (transaction) => {
      const rateSnapshot = await transaction.get(rateRef)
      const state = rateSnapshot.data() || {}
      const inWindow = now - Number(state.windowStartedAt || 0) < 60000
      const attempts = inWindow ? Number(state.attempts || 0) : 0
      if (attempts >= 5) {
        const error = new Error('Too many payment attempts. Wait one minute and try again.')
        error.statusCode = 429
        throw error
      }
      transaction.set(rateRef, {
        uid: user.uid,
        attempts: attempts + 1,
        windowStartedAt: inWindow ? state.windowStartedAt : now,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    const initiationId = randomUUID()
    await db.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(orderRef)
      if (!latestSnapshot.exists) {
        const error = new Error('Order not found.')
        error.statusCode = 404
        throw error
      }
      const latest = latestSnapshot.data()
      if (latest.customerUid !== user.uid) {
        const error = new Error('You do not own this order.')
        error.statusCode = 403
        throw error
      }
      if (latest.paymentStatus === 'Paid' || latest.paymentReference || (latest.paymentInitiationState === 'Starting' && now - Number(latest.paymentInitiationStartedAtMs || now) < 10 * 60 * 1000)) {
        const error = new Error('A payment is already complete or in progress for this order.')
        error.statusCode = 409
        throw error
      }
      transaction.update(orderRef, {
        paymentInitiationId: initiationId,
        paymentInitiationState: 'Starting',
        paymentInitiationStartedAtMs: now,
        paymentInitiatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    const response = await fetch(direct ? getFapshiBaseUrl(apiUrl) + '/direct-pay' : apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apiuser: apiUser, apikey: apiKey },
      redirect: 'error',
      body: JSON.stringify({
        amount: order.amount,
        email: order.customerEmail || user.email || '',
        userId: user.uid,
        externalId: firestoreId,
        message: 'CareNest order ' + String(order.id || firestoreId).slice(0, 80),
        ...(direct ? { phone, name: String(order.customerName || user.name || 'Customer').slice(0, 100) } : {}),
      }),
    })
    const result = await readJsonResponse(response)
    if (!response.ok) {
      await orderRef.update({ paymentInitiationState: 'Failed', updatedAt: FieldValue.serverTimestamp() })
      const authenticationFailed = [401, 403].includes(response.status)
        || /(?:invalid|missing|incorrect).*(?:api.?user|api.?key|credentials?)/i.test(String(result.message || ''))
      if (authenticationFailed) {
        console.error('payment_provider_auth_failed', { provider: 'fapshi', httpStatus: response.status })
        return res.status(503).json({
          code: 'PAYMENT_PROVIDER_AUTH_FAILED',
          error: 'Mobile Money payments are temporarily unavailable. Your order is saved. Please contact CareNest support before retrying.',
        })
      }
      return res.status(response.status).json({ error: result.message || 'Unable to start the Mobile Money payment.' })
    }

    const transactionId = String(result.transId || result.transactionId || result.reference || '').trim()
    if (!transactionId) return res.status(502).json({ error: 'The payment provider did not return a transaction identifier.' })

    await orderRef.update({
      paymentStatus: 'Submitted',
      paymentProvider: 'Fapshi',
      paymentProviderStatus: String(result.status || 'PENDING').toUpperCase(),
      paymentReference: transactionId,
      paymentReceiptTransactionId: transactionId,
      paymentInitiationState: 'Submitted',
      paymentInitiatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(202).json({ accepted: true, message: 'Payment request sent. Await server verification.' })
  } catch (error) {
    if (error.code === 'PAYMENT_CONFIGURATION_ERROR') {
      console.error('payment_configuration_error', { reason: error.message })
      return res.status(503).json({
        code: error.code,
        error: 'Mobile Money payments are temporarily unavailable. Your order is saved. Please contact CareNest support before retrying.',
      })
    }
    const status = Number(error.statusCode || 500)
    return res.status(status).json({ error: status < 500 ? error.message : 'The payment service is temporarily unavailable.' })
  }
}
