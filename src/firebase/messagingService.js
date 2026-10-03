import { getMessaging, getToken, deleteToken, isSupported, onMessage } from 'firebase/messaging'
import { app, auth } from './firebaseConfig'
import { postJson } from '../utils/networkUtils'

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BMtWTkW2uQoB9Yu0PXATqC1nLXXXbkayhwCviIC1Cjo7V29Yki4Hx08jxW2AAAZ_yPHkPiB385J_ip22IfJshE8'
const tokenKey = 'carenest-push-device'
export async function notificationsSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && await isSupported()
}
export async function enableNotifications({ requestPermission = true } = {}) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to enable notifications.')
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Notifications are not supported in this browser. On iPhone, add CareNest to your Home Screen first.')
  const permission = Notification.permission === 'default' && requestPermission ? await Notification.requestPermission() : Notification.permission
  if (!await isSupported()) throw new Error('This browser does not support push notifications.')
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked. Allow them in your browser settings, then try again.' : 'Notification permission was not granted.')
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope/', updateViaCache: 'none' })
  if (!registration.active) await new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting
    if (!worker) { reject(new Error('Notification service is not ready. Try again.')); return }
    if (worker.state === 'activated') { resolve(); return }
    const timeout = setTimeout(() => reject(new Error('Notification service took too long to start. Try again.')), 20000)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') { clearTimeout(timeout); resolve() }
      if (worker.state === 'redundant') { clearTimeout(timeout); reject(new Error('Notification service could not start. Try again.')) }
    })
  })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('No notification token was issued. Please try again.')
  if (auth.currentUser?.uid !== uid) { await deleteToken(messaging); throw new Error('Your account changed. Please try again.') }
  await postJson('/api/notifications', { action: 'register', token })
  localStorage.setItem('carenest-push-opt-in-' + uid, '1')
  localStorage.setItem(tokenKey, JSON.stringify({ uid, token }))
  return true
}
export async function disableNotifications() {
  let device
  try { device = JSON.parse(localStorage.getItem(tokenKey) || 'null') } catch { device = null }
  if (device?.uid === auth.currentUser?.uid && device?.token) await postJson('/api/notifications', { action: 'unregister', token: device.token })
  if (await notificationsSupported()) await deleteToken(getMessaging(app))
  if (auth.currentUser?.uid) localStorage.removeItem('carenest-push-opt-in-' + auth.currentUser.uid)
  localStorage.removeItem(tokenKey)
}
export async function listenForNotifications(callback) {
  if (!await notificationsSupported()) return () => {}
  return onMessage(getMessaging(app), callback)
}
