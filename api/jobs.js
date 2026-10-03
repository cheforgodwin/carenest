import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { confirmedCollection } from '../src/utils/finance.js'
import { notifyOrder } from './_notifications.js'

const available = order => order.status === 'Pending' && !order.providerUid && order.paymentStatus === 'Paid' && confirmedCollection(order)
  && order.paymentEnvironment !== 'sandbox' && Number.isSafeInteger(order.amount) && order.amount >= 100
  && order.refundStatus !== 'Requested' && order.disputeStatus !== 'Open' && order.payoutStatus !== 'Held'
export default async function handler(req, res) {
  if (handleCors(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    const profile = (await db.collection('users').doc(user.uid).get()).data()
    if (profile?.accountType !== 'provider') return send(403, { error: 'An approved provider account is required.' })
    if (req.body?.action === 'list') {
      const result = await db.collection('serviceRequests').where('status', '==', 'Pending').where('paymentStatus', '==', 'Paid').limit(200).get()
      const jobs = result.docs.filter(doc => available(doc.data())).slice(0, 100).map(doc => {
        const order = doc.data()
        return { firestoreId: doc.id, id: order.id, service: order.service, serviceType: order.serviceType, serviceSpeed: order.serviceSpeed, itemSummary: order.itemSummary, amount: order.amount, status: order.status, paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: order.paymentVerifiedBy, financialSnapshot: order.financialSnapshot || null, paymentFinancials: order.paymentFinancials || null, pickupDate: order.pickupDate || '', pickupTime: order.pickupTime || '', address: 'Location available after acceptance', customerName: 'Customer details available after acceptance' }
      })
      return send(200, { jobs })
    }
    if (req.body?.action !== 'accept') return send(400, { error: 'Choose list or accept.' })
    const id = String(req.body.orderId || '')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return send(400, { error: 'A valid order ID is required.' })
    const ref = db.collection('serviceRequests').doc(id)
    await db.runTransaction(async transaction => {
      const currentProfile = (await transaction.get(db.collection('users').doc(user.uid))).data()
      if (currentProfile?.accountType !== 'provider') throw Object.assign(new Error('An approved provider account is required.'), { statusCode: 403 })
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists || !available(snapshot.data())) throw Object.assign(new Error('This job is unpaid, held, or already accepted. Refresh the open jobs.'), { statusCode: 409 })
      transaction.update(ref, { providerUid: user.uid, providerName: String(profile.name || 'Provider').slice(0, 80), providerEmail: profile.email || user.email || '', providerPhone: profile.phone || '', providerPayoutMethod: profile.payout?.method || 'MTN Mobile Money', providerPayoutPhone: profile.payout?.phone || profile.phone || '', status: 'Assigned', currentStep: 1, assignedBy: user.uid, assignedAt: FieldValue.serverTimestamp(), providerAcceptedBy: user.uid, providerAcceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    })
    await notifyOrder(db, id)
    return send(200, { accepted: true, orderId: id })
  } catch (error) { return send(error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to load or accept jobs. Please try again.' }) }
}
