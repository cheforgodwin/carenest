import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { orderFinance } from '../src/utils/finance.js'

const refuse = message => Object.assign(new Error(message), { statusCode: 409 })
export function deletionBlocker(order, uid) {
  if (!['Completed', 'Cancelled'].includes(order.status)) return 'Finish or cancel your active orders before deleting your account.'
  if (order.paymentStatus === 'Submitted' || ['Starting', 'Unknown'].includes(order.paymentInitiationState)) return 'A payment is still being checked. Resolve it before deleting your account.'
  if (order.refundStatus === 'Requested' || order.disputeStatus === 'Open' || order.payoutStatus === 'Held') return 'Resolve outstanding refunds, disputes or payment holds before deleting your account.'
  if (order.paymentStatus === 'Paid' && order.status === 'Cancelled' && Number(order.financeTotals?.refund || 0) < Number(order.amount || 0)) return 'Your cancelled order has an unsettled refund.'
  if (order.paymentStatus === 'Paid' && [order.providerUid, order.riderUid].includes(uid)) {
    const finance = orderFinance(order)
    const due = order.providerUid === uid ? finance.providerDue : finance.riderDue
    if (!finance.paid || due === null || due > 0 || finance.legacyTransfer) return 'Your earnings must be settled before deleting your account.'
  }
  return ''
}
export default async function handler(req, res) {
  if (handleCors(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
  try {
    const user = await requireAuthenticatedUser(req)
    if (req.body?.action !== 'delete' || req.body?.confirmation !== 'DELETE') return send(400, { error: 'Confirm account deletion by typing DELETE.' })
    if (req.body.accountUid !== user.uid) return send(409, { error: 'Your account changed. Confirm deletion again.' })
    const age = Date.now() / 1000 - Number(user.auth_time || 0)
    if (!Number.isFinite(age) || age < -60 || age > 300) return send(401, { error: 'Confirm your password again before deleting your account.' })
    const db = getAdminDb()
    const profileRef = db.collection('users').doc(user.uid)
    const backup = await db.runTransaction(async transaction => {
      const profile = await transaction.get(profileRef)
      if (!profile.exists || profile.data().accountType === 'deleted') throw refuse('This account is already being deleted. Contact support if deletion did not finish.')
      const queries = ['customerUid', 'providerUid', 'riderUid'].map(field => db.collection('serviceRequests').where(field, '==', user.uid))
      const orders = await Promise.all(queries.map(query => transaction.get(query)))
      for (const result of orders) for (const doc of result.docs) {
        const blocker = deletionBlocker(doc.data(), user.uid)
        if (blocker) throw refuse(blocker)
      }
      if (profile.data().accountType === 'admin') {
        const admins = await transaction.get(db.collection('users').where('accountType', '==', 'admin'))
        if (admins.docs.length < 2) throw refuse('Add another administrator before deleting the last admin account.')
      }
      const tokens = await transaction.get(db.collection('pushSubscriptions').where('uid', '==', user.uid))
      const nestedTokens = await transaction.get(profileRef.collection('fcmTokens'))
      const listings = await transaction.get(db.collection('providerListings').where('providerUid', '==', user.uid))
      const application = await transaction.get(db.collection('providerApplications').doc(user.uid))
      const restored = [profile, ...tokens.docs, ...nestedTokens.docs, ...listings.docs, ...(application.exists ? [application] : [])].map(doc => ({ ref: doc.ref, data: doc.data() }))
      if (restored.length > 450) throw refuse('Contact support to delete this account with its large set of linked records.')
      transaction.set(profileRef, { uid: user.uid, name: 'Deleted user', accountType: 'deleted', accountDeletedAt: FieldValue.serverTimestamp() })
      tokens.docs.forEach(doc => transaction.delete(doc.ref))
      nestedTokens.docs.forEach(doc => transaction.delete(doc.ref))
      listings.docs.forEach(doc => transaction.update(doc.ref, { active: false, providerName: 'Deleted provider', providerPhone: '', updatedAt: FieldValue.serverTimestamp() }))
      if (application.exists) transaction.delete(application.ref)
      transaction.delete(db.collection('pushTestRequests').doc(user.uid))
      return restored
    })
    try {
      await getAdminAuth().deleteUser(user.uid)
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        await db.runTransaction(async transaction => {
          const current = await transaction.get(profileRef)
          if (current.data()?.accountType === 'deleted') backup.forEach(item => transaction.set(item.ref, item.data))
        })
        throw error
      }
    }
    return send(200, { deleted: true })
  } catch (error) {
    if (!error.statusCode) console.warn('account_deletion_unavailable')
    return send(error.statusCode || 500, { error: error.statusCode ? error.message : 'Account deletion could not finish. Please try again or contact support.' })
  }
}
