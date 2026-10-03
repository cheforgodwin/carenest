import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { enableNotifications, disableNotifications, listenForNotifications } from '../firebase/messagingService'
import './NotificationControls.css'

export default function NotificationControls() {
  const { user } = useAuth()
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const [update, setUpdate] = useState(null)
  useEffect(() => {
    let stopped = false
    let unsubscribe = () => {}
    if (user) {
      if (localStorage.getItem('carenest-push-opt-in-' + user.uid) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        enableNotifications({ requestPermission: false }).then(() => { if (!stopped) setState('enabled') }).catch(() => {})
      }
      listenForNotifications(payload => {
        if (!stopped) { window.dispatchEvent(new Event('carenest-order-update')); setUpdate({ title: String(payload.data?.title || payload.notification?.title || 'CareNest update').slice(0, 100), body: String(payload.data?.body || payload.notification?.body || 'Open your dashboard for details.').slice(0, 240) }) }
      }).then(stop => { if (stopped) stop(); else unsubscribe = stop }).catch(() => {})
    }
    return () => { stopped = true; unsubscribe() }
  }, [user])
  if (!user) return null
  async function change() {
    const disable = state === 'enabled'
    setState('busy'); setMessage('')
    try {
      if (disable) await disableNotifications()
      else await enableNotifications()
      setState(disable ? 'idle' : 'enabled')
      setMessage(disable ? 'Notifications disabled on this device.' : 'Notifications enabled on this device.')
    } catch (error) { setState(disable ? 'enabled' : 'idle'); setMessage(error.message || 'Could not enable notifications. Please try again.') }
  }
  return <div className="notification-controls">
    <button type="button" onClick={change} disabled={state === 'busy'}>{state === 'busy' ? 'Updating notifications...' : state === 'enabled' ? 'Disable notifications' : 'Enable notifications'}</button>
    {message && <p role="status">{message}</p>}
    {update && <div className="notification-update" role="status"><strong>{update.title}</strong><p>{update.body}</p><button type="button" onClick={() => setUpdate(null)}>Dismiss</button></div>}
  </div>
}
