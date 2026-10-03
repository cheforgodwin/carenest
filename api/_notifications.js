import { createHash } from 'node:crypto'
import { getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { confirmedCollection } from '../src/utils/finance.js'

// Notifications contain no customer phone, address, or payment amount.
export async function notifyOrder(db, orderId) {
  try {
    const order = (await db.collection('serviceRequests').doc(orderId).get()).data()
    if (!order) return
    const paid = order.paymentStatus === 'Paid' && confirmedCollection(order)
    if (!paid && order.paymentStatus !== 'Failed') return
    const eventId = createHash('sha256').update(JSON.stringify([orderId, order.paymentReference, order.paymentStatus, order.status, order.providerUid || '', order.riderUid || '', order.riderStatus || '', order.refundStatus || '', order.disputeStatus || '', order.financeTotals?.provider || 0, order.financeTotals?.rider || 0, order.financeTotals?.refund || 0])).digest('hex')
    const guard = db.collection('pushEvents').doc(eventId)
    const reserved = await db.runTransaction(async transaction => {
      if ((await transaction.get(guard)).exists) return false
      transaction.set(guard, { orderId, createdAt: FieldValue.serverTimestamp(), status: 'Sending' })
      return true
    })
    if (!reserved) return
    const recipients = new Set([order.customerUid, order.providerUid, order.riderUid].filter(Boolean))
    const open = paid && order.paymentEnvironment !== 'sandbox' && order.status === 'Pending' && !order.providerUid && order.refundStatus !== 'Requested' && order.disputeStatus !== 'Open' && order.payoutStatus !== 'Held'
    if (open) {
      const providers = await db.collection('users').where('accountType', '==', 'provider').get()
      providers.docs.forEach(doc => recipients.add(doc.id))
    }
    const subscriptions = []
    for (const uid of recipients) {
      const devices = await db.collection('pushSubscriptions').where('uid', '==', uid).get()
      subscriptions.push(...devices.docs)
    }
    let acceptedCount = 0
    for (let offset = 0; offset < subscriptions.length; offset += 500) {
      const group = subscriptions.slice(offset, offset + 500)
      const messages = group.map(doc => {
        const { uid, token } = doc.data()
        const isOpenJob = open && uid !== order.customerUid
        return { token, data: { title: isOpenJob ? 'New paid job available' : 'CareNest order update', body: isOpenJob ? 'Open CareNest to review and accept an available job.' : order.paymentStatus === 'Failed' ? 'Your payment failed. Open your order for details and payment options.' : order.status === 'Pending' ? 'Payment confirmed. Your order is ready for a provider.' : 'Your order has an update. Open CareNest to view it.', url: uid === order.customerUid ? '/dashboard/customer/orders/' + encodeURIComponent(order.id || orderId) : isOpenJob || uid === order.providerUid ? '/dashboard/provider?view=jobs' : '/dashboard/rider?view=deliveries', eventId }, webpush: { headers: { TTL: '3600', Urgency: 'normal' } } }
      })
      const results = await getMessaging(getApps()[0]).sendEach(messages)
      acceptedCount += results.responses.filter(result => result.success).length
      for (let index = 0; index < results.responses.length; index++) {
        const error = results.responses[index].error
        if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(error?.code)) {
          const device = group[index]
          const uid = device.data().uid
          await db.runTransaction(async transaction => {
            const current = await transaction.get(device.ref)
            if (current.data()?.uid !== uid) return
            transaction.delete(device.ref)
            transaction.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(device.id))
          })
        }
      }
    }
    await guard.update({ status: !subscriptions.length ? 'No devices' : acceptedCount === subscriptions.length ? 'Accepted' : acceptedCount ? 'Partial' : 'Failed', deviceCount: subscriptions.length, acceptedCount, updatedAt: FieldValue.serverTimestamp() })
  } catch {
    // Push delivery must never roll back a payment or job transition.
    console.warn('push_delivery_unavailable', { orderId })
  }
}
