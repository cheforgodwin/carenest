// Opt-in, read-only diagnostics. Never prints credentials, balances or full customer phones.
import { createHash } from 'node:crypto'
import { getFapshiConfig, getFapshiBaseUrl, getFapshiPaymentFlow } from '../api/_fapshi.js'
import { applyVerifiedPayment, fetchVerifiedPayment } from '../api/_paymentVerification.js'
import { getAdminDb } from '../api/_firebaseAdmin.js'
export async function runPaymentDiagnostics() {
  const config = getFapshiConfig()
  const flow = getFapshiPaymentFlow()
  const headers = { apiuser: config.apiUser, apikey: config.apiKey }
  console.log('PAYMENT_CONFIG', JSON.stringify({ environment: new URL(config.apiUrl).hostname, flow, credentialsPresent: true, apiUserFingerprint: createHash('sha256').update(config.apiUser).digest('hex').slice(0, 16), webhookMatchesSite: process.env.FAPSHI_WEBHOOK_URL === 'https://carenest237.com/api/fapshi-webhook' }))
  const balance = await fetch(getFapshiBaseUrl(config.apiUrl) + '/balance', { headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
  console.log('PAYMENT_AUTH_CHECK', JSON.stringify({ status: balance.status, createsPayment: false }))
  await balance.body?.cancel()
  const db = getAdminDb()
  const target = String(process.env.CARENEST_DIAGNOSTIC_ORDER || '').trim()
  let recent = target ? { docs: (await Promise.all([...new Set([target, target.toUpperCase()])].map((id) => db.collection('serviceRequests').where('id', '==', id).limit(2).get()))).flatMap((result) => result.docs) } : await db.collection('serviceRequests').orderBy('createdAt', 'desc').limit(12).get()
  if (target && !recent.docs.length) recent = await db.collection('serviceRequests').orderBy('createdAt', 'desc').limit(20).get()
  console.log('PAYMENT_DIAGNOSTIC_MATCHES', recent.docs.length)
  let checked = 0
  for (const snapshot of recent.docs) {
    const order = snapshot.data()
    const phone = String(order.customerPhone || '').replace(/\D/g, '').replace(/^237/, '')
    console.log('PAYMENT_ORDER', JSON.stringify({ orderId: snapshot.id, orderLabel: order.id, createdAt: order.createdAt?.toDate?.().toISOString(), amount: order.amount, phoneSuffix: phone.slice(-3), phoneValid: /^6\d{8}$/.test(phone), status: order.paymentStatus, initiation: order.paymentInitiationState, environment: order.paymentEnvironment, hasReference: Boolean(order.paymentReference), providerStatus: order.paymentProviderStatus, diagnostic: Boolean(order.paymentDiagnostic) }))
    if (!order.paymentReference || checked >= 3 || !/^[A-Za-z0-9_-]{1,128}$/.test(order.paymentReference)) continue
    checked++
    if (process.env.CARENEST_RECONCILE_DIAGNOSTIC_ORDER === '1' && target && order.id?.toUpperCase() === target.toUpperCase()) {
      const verified = await fetchVerifiedPayment(order.paymentReference)
      const reconciled = await applyVerifiedPayment(db, verified, 'owner-diagnostic', snapshot.id)
      console.log('PAYMENT_RECONCILED', JSON.stringify({ orderId: snapshot.id, status: reconciled.paymentStatus }))
    }
    const response = await fetch(getFapshiBaseUrl(config.apiUrl) + '/payment-status/' + encodeURIComponent(order.paymentReference), { headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
    const body = await response.json().catch(() => ({}))
    const clean = (value) => typeof value === 'string' ? value.replaceAll(config.apiKey, '[redacted]').replaceAll(config.apiUser, '[redacted]').replace(/\b\d{9,}\b/g, '[phone]').slice(0, 160) : undefined
    console.log('PAYMENT_PROVIDER_STATUS', JSON.stringify({ orderId: snapshot.id, httpStatus: response.status, status: body.status, medium: clean(body.medium), transactionId: body.transId, reasonProvided: body.reason != null && body.reason !== '', amount: body.amount, orderMatches: body.externalId === snapshot.id, customerMatches: body.userId === order.customerUid, amountMatches: Number(body.amount) === order.amount, message: clean(body.message), reason: typeof body.reason === 'object' && body.reason ? Object.fromEntries(Object.entries(body.reason).filter(([key]) => ['message', 'code', 'error', 'description', 'reason', 'status'].includes(key)).map(([key, value]) => [key, typeof value === 'number' ? value : clean(value)])) : clean(body.reason), responseFields: Object.keys(body) }))
  }
}
