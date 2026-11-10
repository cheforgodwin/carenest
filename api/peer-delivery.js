import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { safeDeliverySummary } from './_peerDelivery.js'

const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })

  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    const profile = await db.collection('users').doc(user.uid).get()
    if (profile.data()?.accountType !== 'admin') {
      return send(res, 403, { error: 'Administrator access is required.' })
    }
    if (req.body?.action !== 'list') return send(res, 400, { error: 'Choose list.' })

    const snapshot = await db.collection('peerDeliveries').orderBy('createdAt', 'desc').limit(200).get()
    const deliveries = snapshot.docs.map((document) => safeDeliverySummary(document.data(), document.id))
    return send(res, 200, { deliveries })
  } catch (error) {
    if (error.statusCode) return send(res, error.statusCode, { error: error.message })
    console.error('admin_peer_deliveries_unavailable', error)
    return send(res, 500, { error: 'Peer deliveries are temporarily unavailable.' })
  }
}
