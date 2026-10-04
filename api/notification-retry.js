import { timingSafeEqual } from 'node:crypto'
import { getAdminDb } from './_firebaseAdmin.js'
import { processNotificationRetries } from './_notificationRetries.js'
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  if (req.method !== 'GET') return send(405, { error: 'Use GET.' })
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) return send(503, { error: 'Scheduler authentication is not configured.' })
  const expected = Buffer.from('Bearer ' + secret)
  const supplied = Buffer.from(String(req.headers?.authorization || ''))
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'Scheduler authentication required.' })
  try { return send(200, await processNotificationRetries(getAdminDb())) }
  catch { return send(503, { error: 'Notification retry queue unavailable.' }) }
}
