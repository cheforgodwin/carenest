import { notifyOrder } from './_notifications.js'

export async function processNotificationRetries(db) {
  const started = Date.now()
  const [pending, sending] = await Promise.all([
    db.collection('pushEvents').where('status', '==', 'Retry pending').limit(100).get(),
    db.collection('pushEvents').where('status', '==', 'Sending').limit(100).get(),
  ])
  let processed = 0
  let skipped = 0
  for (const event of [...pending.docs, ...sending.docs]) {
    if (processed >= 25 || Date.now() - started > 40000) break
    const data = event.data()
    const due = data.status === 'Sending' ? Date.now() - (data.startedAtMs || 0) > 180000 : Date.now() >= (data.nextAttemptAtMs || 0)
    if (!due) { skipped++; continue }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(data.orderId || '')) { await event.ref.update({ status: 'Invalid' }); skipped++; continue }
    await notifyOrder(db, data.orderId, { retryEventId: event.id })
    processed++
  }
  return { processed, skipped }
}
