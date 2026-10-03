import { createHash } from 'node:crypto'
import { getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { confirmedCollection } from '../src/utils/finance.js'

const transient = code => ['messaging/server-unavailable', 'messaging/internal-error', 'messaging/unknown-error', 'messaging/quota-exceeded'].includes(code)
async function sendWithRetry(messages) {
  const responses = new Array(messages.length)
  let pending = messages.map((message, index) => ({ message, index }))
  for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
    let result
    try { result = await getMessaging(getApps()[0]).sendEach(pending.map(item => item.message)) }
    catch (error) {
      pending.forEach(item => { responses[item.index] = { success: false, error } })
      if (attempt === 2 || !transient(error.code)) break
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
      continue
    }
    const retry = []
    result.responses.forEach((response, index) => {
      const item = pending[index]
      responses[item.index] = response
      if (!response.success && transient(response.error?.code) && attempt < 2) retry.push(item)
    })
    pending = retry
    if (pending.length) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
  }
  return { responses }
}

// Always read saved state; never trust a client-supplied notification or recipient.
export async function notifyOrder(db, orderId) {
  let guard
  try {
    const order = (await db.collection('serviceRequests').doc(orderId).get()).data()
    if (!order) return
    const paid = order.paymentStatus === 'Paid' && confirmedCollection(order)
    const eventId = createHash('sha256').update(JSON.stringify([orderId, order.paymentReference, order.paymentStatus, order.status, order.providerUid || '', order.riderUid || '', order.riderStatus || '', order.refundStatus || '', order.disputeStatus || '', order.payoutStatus || '', order.completionConfirmedBy || '', order.financeTotals?.provider || 0, order.financeTotals?.rider || 0, order.financeTotals?.refund || 0])).digest('hex')
    guard = db.collection('pushEvents').doc(eventId)
    const reserved = await db.runTransaction(async transaction => {
      const current = (await transaction.get(guard)).data()
      if (current && (current.status !== 'Retry pending' && !(current.status === 'Sending' && Date.now() - (current.startedAtMs || 0) > 180000))) return null
      const completed = current?.completedDeviceIds || []
      transaction.set(guard, { orderId, createdAt: FieldValue.serverTimestamp(), status: 'Sending', startedAtMs: Date.now(), completedDeviceIds: completed })
      return completed
    })
    if (!reserved) return
    const completed = new Set(reserved)
    const admins = await db.collection('users').where('accountType', '==', 'admin').get()
    const adminUids = new Set(admins.docs.map(doc => doc.id))
    const recipients = new Set([order.customerUid, ...adminUids, ...(paid ? [order.providerUid, order.riderUid] : [])].filter(Boolean))
    const open = paid && order.paymentEnvironment !== 'sandbox' && order.status === 'Pending' && !order.providerUid && order.refundStatus !== 'Requested' && order.disputeStatus !== 'Open' && order.payoutStatus !== 'Held'
    if (open) {
      const providers = await db.collection('users').where('accountType', '==', 'provider').get()
      providers.docs.forEach(doc => recipients.add(doc.id))
    }
    const subscriptions = []
    for (const uid of recipients) {
      const devices = await db.collection('pushSubscriptions').where('uid', '==', uid).get()
      subscriptions.push(...devices.docs.filter(doc => !completed.has(doc.id)))
    }
    let acceptedCount = 0
    let retryPending = false
    for (let offset = 0; offset < subscriptions.length; offset += 500) {
      const group = subscriptions.slice(offset, offset + 500)
      const messages = group.map(doc => {
        const { uid, token } = doc.data()
        const isAdmin = adminUids.has(uid)
        const isOpenJob = open && !isAdmin && uid !== order.customerUid
        const body = isAdmin ? 'An order or payment has changed. Open CareNest to review it.' : isOpenJob ? 'Open CareNest to review and accept an available job.' : order.paymentStatus === 'Failed' ? 'Your payment failed. Open your order for details and payment options.' : paid && order.status === 'Pending' ? 'Payment confirmed. Your order is ready for a provider.' : order.paymentStatus === 'Submitted' ? 'Payment request sent. Authorize it on the payment phone.' : 'Your order has an update. Open CareNest to view it.'
        const url = isAdmin ? '/dashboard/admin?view=requests' : uid === order.customerUid ? '/dashboard/customer/orders/' + encodeURIComponent(order.id || orderId) : isOpenJob || uid === order.providerUid ? '/dashboard/provider?view=jobs' : '/dashboard/rider?view=deliveries'
        return { token, data: { title: isAdmin ? 'CareNest admin update' : isOpenJob ? 'New paid job available' : 'CareNest order update', body, url, eventId }, webpush: { headers: { TTL: '3600', Urgency: 'normal' } } }
      })
      const results = await sendWithRetry(messages)
      for (let index = 0; index < results.responses.length; index++) {
        const result = results.responses[index]
        const device = group[index]
        const invalid = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.error?.code)
        if (result.success) acceptedCount++
        if (result.success || invalid) completed.add(device.id)
        else retryPending = true
        if (invalid) {
          const uid = device.data().uid
          await db.runTransaction(async transaction => {
            const current = await transaction.get(device.ref)
            if (current.data()?.uid !== uid) return
            transaction.delete(device.ref)
            transaction.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(device.id))
          })
        }
      }
      await guard.update({ completedDeviceIds: [...completed], updatedAt: FieldValue.serverTimestamp() })
    }
    await guard.update({ status: retryPending ? 'Retry pending' : !subscriptions.length && !completed.size ? 'No devices' : 'Accepted', deviceCount: subscriptions.length, acceptedCount, completedDeviceIds: [...completed], updatedAt: FieldValue.serverTimestamp() })
  } catch {
    if (guard) await guard.update({ status: 'Retry pending', updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    console.warn('push_delivery_unavailable', { orderId })
  }
}

export async function sendTestNotification(db, uid) {
  const guard = db.collection('pushTestRequests').doc(uid)
  await db.runTransaction(async transaction => {
    const current = (await transaction.get(guard)).data()
    if (Date.now() - (current?.sentAtMs || 0) < 60000) throw Object.assign(new Error('Please wait one minute before testing again.'), { statusCode: 429 })
    transaction.set(guard, { sentAtMs: Date.now() })
  })
  const devices = await db.collection('pushSubscriptions').where('uid', '==', uid).get()
  if (!devices.docs.length) throw Object.assign(new Error('Enable notifications on this account first.'), { statusCode: 400 })
  const profile = (await db.collection('users').doc(uid).get()).data()
  const role = ['admin', 'provider', 'rider'].includes(profile?.accountType) ? profile.accountType : 'customer'
  let accepted = 0
  for (let offset = 0; offset < devices.docs.length; offset += 500) {
    const result = await sendWithRetry(devices.docs.slice(offset, offset + 500).map(doc => ({ token: doc.data().token, data: { title: 'CareNest notifications test', body: 'Notifications are connected to your CareNest account.', url: '/dashboard/' + role, eventId: 'test-' + uid + '-' + Date.now() }, webpush: { headers: { TTL: '300' } } })))
    accepted += result.responses.filter(response => response.success).length
  }
  if (!accepted) throw Object.assign(new Error('No device accepted the test. Disable and enable notifications, then retry.'), { statusCode: 503 })
  return { accepted }
}
