import { FieldValue } from 'firebase-admin/firestore'
import { providerFee } from '../src/utils/finance.js'
import { entryId, financialEntry } from './_finance.js'
import { getFapshiBaseUrl, getFapshiConfig, readJsonResponse } from './_fapshi.js'

export function paymentError(message, statusCode = 409) {
  return Object.assign(new Error(message), { statusCode })
}

async function providerGet(path) {
  const { apiUrl, apiUser, apiKey } = getFapshiConfig()
  const response = await fetch(getFapshiBaseUrl(apiUrl) + path, {
    headers: { apiuser: apiUser, apikey: apiKey }, redirect: 'error', signal: AbortSignal.timeout(15000),
  })
  const result = await readJsonResponse(response)
  if (!response.ok) throw paymentError('Payment verification is temporarily unavailable. Please check again later.', 503)
  return result
}

export async function fetchVerifiedPayment(transactionId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) throw paymentError('Invalid Fapshi transaction ID.', 400)
  const payment = await providerGet('/payment-status/' + encodeURIComponent(transactionId))
  if (String(payment.transId || payment.transactionId || '') !== transactionId) {
    throw paymentError('Transaction verification mismatch.', 400)
  }
  const expectedWebhook = String(process.env.FAPSHI_WEBHOOK_URL || '').trim().replace(/\/$/, '')
  const verifiedWebhook = String(payment.webhook || '').trim().replace(/\/$/, '')
  if (expectedWebhook && verifiedWebhook && expectedWebhook !== verifiedWebhook) throw paymentError('Payment belongs to a different webhook.', 400)
  if (payment.transType && payment.transType !== 'Collection') throw paymentError('Payment is not a collection.', 400)
  return { ...payment, verifiedEnvironment: getFapshiConfig().apiUrl.includes('sandbox') ? 'sandbox' : 'live' }
}

// All reads and writes share one transaction, including late callbacks and polling.
export async function applyVerifiedPayment(db, payment, source, expectedOrderId = '') {
  const firestoreId = String(payment.externalId || '').trim()
  const reference = String(payment.transId || payment.transactionId || '')
  if (!firestoreId || firestoreId.length > 128 || firestoreId.includes('/') || (expectedOrderId && firestoreId !== expectedOrderId)) {
    throw paymentError('Invalid CareNest order binding.', 400)
  }
  const providerStatus = String(payment.status || '').toUpperCase()
  if (!['CREATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED'].includes(providerStatus)) throw paymentError('Unknown payment status.', 502)
  const orderRef = db.collection('serviceRequests').doc(firestoreId)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef)
    if (!snapshot.exists) throw paymentError('Matching CareNest order not found.', 404)
    const order = snapshot.data()
    const bound = order.paymentReference === reference && order.paymentReceiptTransactionId === reference
    const recoverable = !order.paymentReference && !order.paymentReceiptTransactionId
      && ['Starting', 'Unknown'].includes(order.paymentInitiationState)
      && order.paymentInitiatedBy === order.customerUid
    if ((!bound && !recoverable) || !order.customerUid || payment.userId !== order.customerUid
      || !Number.isInteger(order.amount) || Number(payment.amount) !== order.amount) {
      throw paymentError('Payment does not match the bound order.', 400)
    }
    if (order.paymentEnvironment && payment.verifiedEnvironment && order.paymentEnvironment !== payment.verifiedEnvironment) throw paymentError('Payment environment mismatch.', 400)
    const verifiedOrder = { ...order, ...(payment.verifiedEnvironment ? { paymentEnvironment: payment.verifiedEnvironment } : {}) }
    const enrichEnvironment = !order.paymentEnvironment && Boolean(payment.verifiedEnvironment)
    if (['Paid', 'Refunded'].includes(order.paymentStatus) && providerStatus !== 'SUCCESSFUL') {
      return { received: true, orderId: order.id || firestoreId, paymentStatus: order.paymentStatus }
    }
    const paymentStatus = order.paymentStatus === 'Refunded' ? 'Refunded' : providerStatus === 'SUCCESSFUL' ? 'Paid'
      : ['FAILED', 'EXPIRED'].includes(providerStatus) ? 'Failed' : 'Submitted'
    const fee = providerStatus === 'SUCCESSFUL' ? providerFee(payment) : { amount: null }
    const eventRef = db.collection('financialEntries').doc(entryId('collection', firestoreId, reference, providerStatus))
    const event = await transaction.get(eventRef)
    const feeKnown = Number.isSafeInteger(order.paymentFinancials?.fapshiFee)
    const enrichFee = !feeKnown && fee.amount !== null
    if (feeKnown && fee.amount !== null && order.paymentFinancials.fapshiFee !== fee.amount) throw paymentError('Provider fee changed. Manual reconciliation is required.')
    if (bound && order.paymentVerifiedAt && order.paymentStatus === 'Failed' && paymentStatus === 'Submitted') return { received: true, orderId: order.id || firestoreId, paymentStatus: order.paymentStatus }
    if (event.exists && !enrichFee && !enrichEnvironment) return { received: true, orderId: order.id || firestoreId, paymentStatus: order.paymentStatus }
    if (!event.exists) transaction.set(eventRef, financialEntry(verifiedOrder, firestoreId, 'collection', { reference, amount: order.amount, status: providerStatus, fapshiFee: fee.amount, source }))
    if (enrichFee) transaction.set(db.collection('financialEntries').doc(entryId('fee', firestoreId, reference)), financialEntry(verifiedOrder, firestoreId, 'fapshi_fee', { reference, amount: fee.amount, status: 'Verified', source }))
    const paymentFinancials = feeKnown ? order.paymentFinancials : { fapshiFee: fee.amount, revenue: fee.revenue ?? null, feePercent: fee.percent ?? null, feeSource: fee.amount === null ? 'unknown' : 'provider-revenue' }
    transaction.update(orderRef, {
      paymentFinancials,
      ...(payment.verifiedEnvironment ? { paymentEnvironment: payment.verifiedEnvironment } : {}),
      paymentReference: reference, paymentReceiptTransactionId: reference,
      paymentProvider: 'Fapshi', paymentInitiationState: 'Submitted', paymentStatus,
      paymentProviderStatus: providerStatus, paymentConfirmedAt: payment.dateConfirmed || null,
      paymentVerifiedAt: FieldValue.serverTimestamp(), paymentVerifiedBy: source,
      ...(paymentStatus === 'Paid' && !order.paidAt ? { paidAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { received: true, orderId: order.id || firestoreId, paymentStatus }
  })
}

export async function reconcileOrderPayment(db, orderRef, firestoreId, userUid) {
  const order = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef)
    if (!snapshot.exists) throw paymentError('Order not found.', 404)
    const current = snapshot.data()
    if (current.customerUid !== userUid) throw paymentError('You do not own this order.', 403)
    if (['Paid', 'Refunded'].includes(current.paymentStatus) && Number.isSafeInteger(current.paymentFinancials?.fapshiFee)) return current
    if (Date.now() - Number(current.paymentLastCheckedAtMs || 0) < 15000) {
      throw paymentError('Please wait 15 seconds before checking the payment again.', 429)
    }
    transaction.update(orderRef, { paymentLastCheckedAtMs: Date.now() })
    return current
  })
  if (['Paid', 'Refunded'].includes(order.paymentStatus) && Number.isSafeInteger(order.paymentFinancials?.fapshiFee)) return { paymentStatus: order.paymentStatus }
  let reference = order.paymentReference
  if (!reference && ['Starting', 'Unknown'].includes(order.paymentInitiationState)) {
    const query = new URLSearchParams({ amt: String(order.amount), limit: '100', sort: 'desc' })
    if (order.paymentInitiationStartedAtMs) query.set('start', new Date(order.paymentInitiationStartedAtMs).toISOString().slice(0, 10))
    const results = await providerGet('/search?' + query)
    if (!Array.isArray(results)) throw paymentError('Unable to reconcile the payment. Contact CareNest support.', 503)
    const matches = results.filter((item) => item.externalId === firestoreId && item.userId === userUid && Number(item.amount) === order.amount)
    if (matches.length === 1) reference = matches[0].transId
    // Search is limited: an absent or ambiguous match never authorizes another charge.
    if (!reference) throw paymentError('The previous payment outcome is still unknown. Contact CareNest support before paying again.')
  }
  if (!reference) return { paymentStatus: order.paymentStatus || 'Pending', message: 'No payment request is awaiting verification.' }
  const payment = await fetchVerifiedPayment(reference)
  return applyVerifiedPayment(db, payment, 'fapshi-poll', firestoreId)
}
