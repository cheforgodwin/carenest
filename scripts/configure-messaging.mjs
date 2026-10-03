// Explicit build-time opt-in. Enables only the FCM services for CareNest.
import { cert } from 'firebase-admin/app'
import { getAdminDb } from '../api/_firebaseAdmin.js'
export async function configureMessaging() {
  if (process.env.CARENEST_CONFIGURE_MESSAGING !== '1') return
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
  if (credentials.project_id !== 'carenest-11319') throw new Error('Unexpected Firebase project.')
  const token = await cert(credentials).getAccessToken()
  const headers = { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' }
  async function request(url, method = 'GET') {
    const response = await fetch(url, { method, headers, redirect: 'error', signal: AbortSignal.timeout(20000) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Messaging configuration refused (HTTP ' + response.status + ').')
    return result
  }
  const projectNumber = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  if (!/^\d+$/.test(String(projectNumber || ''))) throw new Error('Project number unavailable.')
  for (const service of ['fcm.googleapis.com', 'fcmregistrations.googleapis.com']) {
    const url = 'https://serviceusage.googleapis.com/v1/projects/' + projectNumber + '/services/' + service
    let state = await request(url)
    if (state.state !== 'ENABLED') {
      const operation = await request(url + ':enable', 'POST')
      if (operation.name) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const current = await request('https://serviceusage.googleapis.com/v1/' + operation.name)
          if (current.error) throw new Error('Messaging service activation failed.')
          if (current.done) break
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      state = await request(url)
    }
    if (state.state !== 'ENABLED') throw new Error('Messaging activation has not completed.')
    console.log('MESSAGING_SERVICE_READY', JSON.stringify({ service, enabled: true }))
  }
  // Validate the actual paid-job query without reading/logging private customer details.
  await getAdminDb().collection('serviceRequests').where('status', '==', 'Pending').where('paymentStatus', '==', 'Paid').limit(1).get()
  console.log('PAID_JOB_QUERY_READY')
}
