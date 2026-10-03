import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { notifyOrder } from './_notifications.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    if (req.body?.action === 'syncOrder') {
      const id = String(req.body.orderId || '')
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return send(400, { error: 'Invalid order.' })
      const order = (await db.collection('serviceRequests').doc(id).get()).data()
      if (!order || ![order.customerUid, order.providerUid, order.riderUid].includes(user.uid)) {
        const profile = (await db.collection('users').doc(user.uid).get()).data()
        if (!order || profile?.accountType !== 'admin') return send(403, { error: 'You cannot notify this order.' })
      }
      await notifyOrder(db, id)
      return send(200, { synced: true })
    }
    if (!['register', 'unregister'].includes(req.body?.action)) return send(400, { error: 'Invalid notification action.' })
    const token = String(req.body.token || '')
    if (!/^[A-Za-z0-9_:.-]{20,4096}$/.test(token)) return send(400, { error: 'Invalid device token.' })
    const id = createHash('sha256').update(token).digest('hex')
    const ref = db.collection('pushSubscriptions').doc(id)
    const profile = (await db.collection('users').doc(user.uid).get()).data()
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref)
      const oldUid = current.data()?.uid
      if (req.body.action === 'unregister') {
        if (oldUid && oldUid !== user.uid) throw Object.assign(new Error('This device is not registered to your account.'), { statusCode: 403 })
        transaction.delete(ref)
        transaction.delete(db.collection('users').doc(user.uid).collection('fcmTokens').doc(id))
        return
      }
      if (oldUid && oldUid !== user.uid) transaction.delete(db.collection('users').doc(oldUid).collection('fcmTokens').doc(id))
      const data = { uid: user.uid, token, role: profile?.accountType || 'customer', updatedAt: FieldValue.serverTimestamp() }
      transaction.set(ref, data)
      transaction.set(db.collection('users').doc(user.uid).collection('fcmTokens').doc(id), data)
    })
    return send(200, { enabled: req.body.action === 'register' })
  } catch (error) { return send(error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to save notification preferences. Please try again.' }) }
}
