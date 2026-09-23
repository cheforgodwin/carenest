// Read-only by default. Live requests require an explicit phone-owner-approved opt-in.
import { readFile } from 'node:fs/promises'
import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getFapshiConfig, getFapshiPaymentFlow } from '../api/_fapshi.js'

if (process.env.CARENEST_ALLOW_LIVE_PAYMENT_TEST !== '1') {
  getFapshiPaymentFlow()
  await import('./check-fapshi-credentials.mjs')
} else {
  const config = getFapshiConfig()
  if (new URL(config.apiUrl).hostname !== 'live.fapshi.com' || getFapshiPaymentFlow() !== 'direct') throw new Error('Live diagnostics require live Direct Pay configuration.')
  const phone = String(process.env.CARENEST_PAYMENT_TEST_PHONE || '').replace(/\D/g, '').replace(/^237/, '')
  const testId = String(process.env.CARENEST_PAYMENT_TEST_ID || '')
  if (!/^6\d{8}$/.test(phone) || !/^[a-zA-Z0-9_-]{8,60}$/.test(testId)) throw new Error('Provide an authorized Cameroon phone and a unique diagnostic test ID.')
  const siteUrl = String(process.env.CARENEST_SITE_URL || 'https://carenest237.com').replace(/\/$/, '')
  if (siteUrl !== 'https://carenest237.com') throw new Error('Live diagnostic endpoint must be the canonical CareNest site.')
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY
  if (!apiKey || apiKey === '[SENSITIVE]') throw new Error('A real Firebase public API key is required.')
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE ? await readFile(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8') : '')
  if (!raw || raw === '[SENSITIVE]') throw new Error('Server-side Firebase credentials are required.')
  const app = initializeApp({ credential: cert(JSON.parse(raw)) }, 'payment-diagnostic-' + testId)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const uid = 'payment-diagnostic-' + testId
  const orderRef = db.collection('serviceRequests').doc(uid)
  const guardRef = db.collection('paymentDiagnostics').doc(testId)
  let accountCreated = false
  try {
    // A durable reservation prevents a failed build/re-run from sending a second request.
    const reserved = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(guardRef)
      if (existing.exists) return false
      transaction.create(guardRef, { orderId: uid, amount: 100, phoneSuffix: phone.slice(-3), reservedAt: FieldValue.serverTimestamp(), status: 'Reserved' })
      return true
    })
    if (!reserved) {
      console.log('LIVE_DIAGNOSTIC_ALREADY_RESERVED', JSON.stringify({ orderId: uid, message: 'No new request was sent. Inspect the existing test before any further action.' }))
    } else {
      await auth.createUser({ uid, displayName: 'CareNest payment diagnostic' })
      accountCreated = true
      const email = String(process.env.CARENEST_PAYMENT_TEST_EMAIL || '')
      await db.collection('users').doc(uid).create({ uid, name: 'CareNest payment diagnostic', email, phone: '+237' + phone, accountType: 'customer', paymentDiagnostic: true })
      await orderRef.create({ id: 'DIAG-' + testId, customerUid: uid, customerEmail: email, customerName: 'CareNest payment diagnostic', customerPhone: '+237' + phone, amount: 100, paymentStatus: 'Pending', paymentReference: '', paymentReceiptTransactionId: '', status: 'Payment diagnostic', serviceType: 'diagnostic', service: 'Owner-authorized 100 XAF prompt check', paymentDiagnostic: true, createdAt: FieldValue.serverTimestamp() })
      const customToken = await auth.createCustomToken(uid)
      const exchange = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + encodeURIComponent(apiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }), redirect: 'error', signal: AbortSignal.timeout(15000) })
      const session = await exchange.json()
      if (!exchange.ok || !session.idToken) throw new Error('Diagnostic sign-in failed (HTTP ' + exchange.status + '). No payment was requested.')
      await guardRef.update({ status: 'Dispatching', dispatchedAt: FieldValue.serverTimestamp() })
      let response
      try {
        response = await fetch(siteUrl + '/api/payments', { method: 'POST', headers: { Authorization: 'Bearer ' + session.idToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ firestoreId: uid }), redirect: 'error', signal: AbortSignal.timeout(45000) })
      } catch {
        await guardRef.update({ status: 'Unknown' })
        throw new Error('The diagnostic request outcome is unknown. Do not send another request; inspect the retained order.')
      }
      const result = await response.json().catch(() => ({}))
      const accepted = response.status === 202 && result.accepted === true
      await guardRef.update({ status: accepted ? 'Accepted' : 'Review required', httpStatus: response.status, checkedAt: FieldValue.serverTimestamp() })
      const saved = (await orderRef.get()).data() || {}
      console.log('LIVE_DIAGNOSTIC_RESULT', JSON.stringify({ orderId: uid, amount: 100, phoneSuffix: phone.slice(-3), httpStatus: response.status, accepted, code: result.code, paymentStatus: saved.paymentStatus, initiationState: saved.paymentInitiationState, hasReference: Boolean(saved.paymentReference) }))
      if (!accepted) throw new Error('Diagnostic request was not accepted. Evidence has been retained; no automatic retry will occur.')
      console.log('Phone delivery and approval still require confirmation from the phone owner. No payment success has been fabricated.')
    }
  } finally {
    if (accountCreated) await auth.updateUser(uid, { disabled: true }).catch(() => {})
    await deleteApp(app)
    console.log('Diagnostic order, dispatch guard and financial history retained for reconciliation.')
  }
}
