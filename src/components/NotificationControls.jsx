import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { enableNotifications, disableNotifications } from '../firebase/messagingService'
import './NotificationControls.css'

function UserNotificationControls({ user }) {
  const [state, setState] = useState(() => localStorage.getItem('carenest-push-opt-in-' + user.uid) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'enabled' : 'idle')
  const [message, setMessage] = useState('')
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
  </div>
}

export default function NotificationControls() {
  const { user } = useAuth()
  return user ? <UserNotificationControls key={user.uid} user={user} /> : null
}
