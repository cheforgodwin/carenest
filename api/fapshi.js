import { FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { getFapshiBaseUrl, getFapshiConfig, readJsonResponse } from './_fapshi.js'
import { reconcileOrderPayment, paymentError } from './_paymentVerification.js'
import { financialSnapshot } from '../src/utils/finance.js'
import { entryId, financialEntry } from './_finance.js'
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
    if (req.body?.action === 'verify') {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(await reconcileOrderPayment(db, orderRef, firestoreId, user.uid))
    }
    const snapshot = await orderRef.get()
    if (!snapshot.exists) return res.status(404).json({ error: 'Order not found.' })

    const order = snapshot.data()
    if (order.customerUid !== user.uid) return res.status(403).json({ error: 'You do not own this order.' })
    if (!Number.isInteger(order.amount) || order.amount < 100) return res.status(409).json({ error: 'The order amount is invalid.' })
    if (['Cancelled', 'Complaint', 'Completed'].includes(order.status)) throw paymentError('This order cannot accept a payment.')
    if (['Paid', 'Refunded'].includes(order.paymentStatus)) return res.status(409).json({ error: 'This order has already been paid.' })
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
      if (['Paid', 'Refunded'].includes(latest.paymentStatus) || latest.paymentReference || ['Starting', 'Unknown'].includes(latest.paymentInitiationState)) {
        const error = new Error('A payment is already complete or in progress for this order.')
        error.statusCode = 409
        throw error
      }
      if (latest.amount !== order.amount || latest.customerPhone !== order.customerPhone || ['Cancelled', 'Complaint', 'Completed'].includes(latest.status)) throw paymentError('The order changed. Reload it before paying.')
      const policy = (await transaction.get(db.collection('financialSettings').doc('current'))).data()
      const snapshot = latest.financialSnapshot || financialSnapshot(latest, policy)
      const environment = apiUrl.includes('sandbox.fapshi.com') ? 'sandbox' : 'live'
      transaction.set(db.collection('financialEntries').doc(entryId('attempt', initiationId)), financialEntry({ ...latest, paymentEnvironment: environment }, firestoreId, 'payment_attempt', { amount: latest.amount, reference: initiationId, status: 'Starting' }))
      transaction.update(orderRef, {
        financialSnapshot: snapshot,
        paymentEnvironment: environment,
        paymentInitiationId: initiationId,
        paymentInitiationState: 'Starting',
        paymentInitiationStartedAtMs: now,
        paymentInitiatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    const updateAttempt = (payload) => db.runTransaction(async (transaction) => {
      const current = (await transaction.get(orderRef)).data()
      if (current?.paymentInitiationId !== initiationId || current.paymentReference || ['Paid', 'Refunded'].includes(current.paymentStatus)) return
      transaction.set(db.collection('financialEntries').doc(entryId('attempt', initiationId, payload.paymentInitiationState)), financialEntry(current, firestoreId, 'payment_attempt', { amount: current.amount, reference: initiationId, status: payload.paymentInitiationState }))
      transaction.update(orderRef, { ...payload, updatedAt: FieldValue.serverTimestamp() })
    })
    let response
    let result
    try {
      response = await fetch(direct ? getFapshiBaseUrl(apiUrl) + '/direct-pay' : apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apiuser: apiUser, apikey: apiKey },
        redirect: 'error', signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          amount: order.amount,
          email: order.customerEmail || user.email || '',
          userId: user.uid,
          externalId: firestoreId,
          message: 'CareNest order ' + String(order.id || firestoreId).slice(0, 80),
          ...(direct ? { phone, name: String(order.customerName || user.name || 'Customer').slice(0, 100) } : {}),
        }),
      })
      result = await readJsonResponse(response)
    } catch {
      await updateAttempt({ paymentInitiationState: 'Unknown' })
      throw paymentError('The payment outcome is unknown. Check payment status before paying again.', 503)
    }
    if (!response.ok) {
      const rejected = [400, 401, 403, 404, 422].includes(response.status)
      await updateAttempt({ paymentInitiationState: rejected ? 'Failed' : 'Unknown' })
      const authenticationFailed = response.status === 401
        || /(?:invalid|missing|incorrect).*(?:api.?user|api.?key|credentials?)/i.test(String(result.message || ''))
      if (authenticationFailed) {
        console.error('payment_provider_auth_failed', { provider: 'fapshi', httpStatus: response.status })
        return res.status(503).json({
          code: 'PAYMENT_PROVIDER_AUTH_FAILED',
          error: 'Mobile Money payments are temporarily unavailable. Your order is saved. Please contact CareNest support before retrying.',
        })
      }
      if (response.status === 403) {
        console.error('payment_provider_access_denied', {
          provider: 'fapshi', httpStatus: response.status,
          flow: direct ? 'direct' : 'hosted',
        })
        return res.status(503).json({
          code: 'PAYMENT_PROVIDER_ACCESS_DENIED',
          error: 'The payment provider has not allowed this payment request. Your order is saved. Please contact CareNest support.',
        })
      }
      return res.status(response.status).json({ error: result.message || 'Unable to start the Mobile Money payment.' })
    }

    const transactionId = String(result.transId || result.transactionId || result.reference || '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
      await updateAttempt({ paymentInitiationState: 'Unknown' })
      throw paymentError('The payment outcome is unknown. Check payment status before paying again.', 502)
    }

    await updateAttempt({
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
    return res.status(status).json({ error: error.statusCode ? error.message : 'The payment service is temporarily unavailable.' })
  }
}
