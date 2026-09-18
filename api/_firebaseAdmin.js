import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  const existing = getApps()[0]
  if (existing) return existing
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON.')
  let credentials
  try { credentials = JSON.parse(raw) } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.') }
  return initializeApp({ credential: cert(credentials) })
}

export const getAdminDb = () => getFirestore(getAdminApp())

export async function requireAuthenticatedUser(req) {
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)
  if (!match) {
    const error = new Error('Authentication is required.')
    error.statusCode = 401
    throw error
  }
  try {
    return await getAuth(getAdminApp()).verifyIdToken(match[1], true)
  } catch {
    const error = new Error('Your session is invalid or expired. Please sign in again.')
    error.statusCode = 401
    throw error
  }
}
