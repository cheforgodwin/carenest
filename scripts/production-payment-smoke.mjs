import { readFile } from 'node:fs/promises'
import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
const apiKey = process.env.FIREBASE_WEB_API_KEY
const siteUrl = String(process.env.CARENEST_SITE_URL || 'https://carenest237.com').replace(/\/$/, '')
if (!credentialPath || !apiKey) throw new Error('Smoke-test credentials are missing.')

const credential = JSON.parse(await readFile(credentialPath, 'utf8'))
const app = initializeApp({ credential: cert(credential) }, `payment-smoke-${Date.now()}`)
const auth = getAuth(app)
const db = getFirestore(app)
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const uid = `payment-smoke-${suffix}`
const firestoreId = `payment-smoke-${suffix}`
const email = `${uid}@example.com`
const profileRef = db.collection('users').doc(uid)
const orderRef = db.collection('serviceRequests').doc(firestoreId)
const rateRef = db.collection('paymentRateLimits').doc(uid)

try {
  await auth.createUser({ uid, email, emailVerified: true, displayName: 'Payment Smoke Test' })
  await profileRef.set({ uid, email, name: 'Payment Smoke Test', phone: '+237670000000', accountType: 'customer' })
  await orderRef.set({
    id: `SMOKE-${suffix}`,
    customerUid: uid,
    customerEmail: email,
    customerName: 'Payment Smoke Test',
    customerPhone: '+237670000000',
    amount: 100,
    paymentStatus: 'Pending',
    status: 'Pending',
    service: 'Payment smoke test',
    createdAt: new Date(),
  })

  const customToken = await auth.createCustomToken(uid)
  const exchange = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const exchangeBody = await exchange.json()
  if (!exchange.ok || !exchangeBody.idToken) throw new Error(`Token exchange failed (${exchange.status}).`)

  const initiation = await fetch(`${siteUrl}/api/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${exchangeBody.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firestoreId }),
  })
  const initiationBody = await initiation.json()
  console.log(`PAYMENT_INIT_STATUS=${initiation.status}`)
  if (!initiation.ok || !initiationBody.transId) throw new Error(`Payment initiation failed: ${initiationBody.error || initiationBody.message || initiation.status}`)

  const webhook = await fetch(`${siteUrl}/api/fapshi-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transId: initiationBody.transId }),
  })
  const webhookBody = await webhook.json()
  console.log(`WEBHOOK_STATUS=${webhook.status}`)
  if (!webhook.ok) throw new Error(`Webhook verification failed: ${webhookBody.error || webhook.status}`)

  const finalSnapshot = await orderRef.get()
  const finalOrder = finalSnapshot.data() || {}
  console.log(`FINAL_PAYMENT_STATUS=${finalOrder.paymentStatus || 'missing'}`)
  console.log(`VERIFIED_BY=${finalOrder.paymentVerifiedBy || 'missing'}`)
  if (finalOrder.paymentStatus !== 'Paid' || finalOrder.paymentVerifiedBy !== 'fapshi-webhook') {
    throw new Error('The order was not marked paid by the verified webhook.')
  }
} finally {
  await Promise.allSettled([orderRef.delete(), rateRef.delete(), profileRef.delete(), auth.deleteUser(uid)])
  await deleteApp(app)
  console.log('TEMPORARY_FIREBASE_DATA=REMOVED')
}
