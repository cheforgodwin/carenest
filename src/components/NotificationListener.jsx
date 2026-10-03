import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { enableNotifications, listenForNotifications } from '../firebase/messagingService'
import './NotificationControls.css'

function UserNotificationListener({ user }) {
  const [update, setUpdate] = useState(null)
  useEffect(() => {
    let stopped = false
    let unsubscribe = () => {}
    if (localStorage.getItem('carenest-push-opt-in-' + user.uid) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      enableNotifications({ requestPermission: false }).catch(() => {})
    }
    listenForNotifications(payload => {
      if (!stopped) {
        window.dispatchEvent(new Event('carenest-order-update'))
        setUpdate({ title: String(payload.data?.title || payload.notification?.title || 'CareNest update').slice(0, 100), body: String(payload.data?.body || payload.notification?.body || 'Open your dashboard for details.').slice(0, 240) })
      }
    }).then(stop => { if (stopped) stop(); else unsubscribe = stop }).catch(() => {})
    return () => { stopped = true; unsubscribe() }
  }, [user])
  return update ? <div className="notification-update notification-global" role="status"><strong>{update.title}</strong><p>{update.body}</p><button type="button" onClick={() => setUpdate(null)}>Dismiss</button></div> : null
}
export default function NotificationListener() {
  const { user } = useAuth()
  return user ? <UserNotificationListener key={user.uid} user={user} /> : null
}
