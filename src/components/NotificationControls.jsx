import { useEffect, useRef, useState } from 'react'
import { FiBell, FiX } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import { enableNotifications, disableNotifications } from '../firebase/messagingService'
import './NotificationControls.css'

const notificationDetails = {
  customer: {
    heading: 'Your bookings and payments',
    description: 'Get updates when a booking is accepted or its status changes, and when a payment is submitted, confirmed, or needs attention.',
  },
  provider: {
    heading: 'New work and job updates',
    description: 'Get alerts when a paid customer request is available and updates for orders assigned to you.',
  },
  rider: {
    heading: 'Delivery assignments and updates',
    description: 'Get updates about delivery work assigned to you and changes to the related order.',
  },
  admin: {
    heading: 'Orders and payment activity',
    description: 'Get alerts when an order or payment changes and needs your attention in the admin dashboard.',
  },
}

function UserNotificationControls({ user, profile }) {
  const [state, setState] = useState(() => localStorage.getItem('carenest-push-opt-in-' + user.uid) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'enabled' : 'idle')
  const [message, setMessage] = useState('')
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const enableButtonRef = useRef(null)
  const confirmButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const role = notificationDetails[profile?.accountType] ? profile.accountType : 'customer'
  const details = notificationDetails[role]

  useEffect(() => {
    if (!isPromptOpen) return undefined
    confirmButtonRef.current?.focus()
    function closeOnEscape(event) {
      if (event.key === 'Escape') closePrompt()
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll('button')
        if (!buttons?.length) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isPromptOpen])

  if (!user) return null

  function closePrompt() {
    setIsPromptOpen(false)
    window.requestAnimationFrame(() => enableButtonRef.current?.focus())
  }

  async function updateNotifications(disable) {
    closePrompt()
    setState('busy')
    setMessage('')
    try {
      if (disable) await disableNotifications()
      else await enableNotifications()
      setState(disable ? 'idle' : 'enabled')
      setMessage(disable ? 'Notifications disabled on this device.' : 'Notifications enabled on this device.')
    } catch (error) {
      setState(disable ? 'enabled' : 'idle')
      setMessage(error.message || 'Could not enable notifications. Please try again.')
    } finally {
      enableButtonRef.current?.focus()
    }
  }

  return <div className="notification-controls">
    <button
      ref={enableButtonRef}
      type="button"
      onClick={() => state === 'enabled' ? updateNotifications(true) : setIsPromptOpen(true)}
      disabled={state === 'busy'}
    >
      {state === 'busy' ? 'Updating notifications...' : state === 'enabled' ? 'Disable notifications' : 'Enable notifications'}
    </button>
    {message && <p role="status">{message}</p>}
    {isPromptOpen && (
      <div className="notification-dialog-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePrompt()
      }}>
        <section ref={dialogRef} className="notification-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-dialog-title" aria-describedby="notification-dialog-description">
          <button className="notification-dialog-close" type="button" aria-label="Close notification information" onClick={closePrompt}><FiX /></button>
          <span className="notification-dialog-icon"><FiBell /></span>
          <h2 id="notification-dialog-title">Enable CareNest notifications?</h2>
          <h3>{details.heading}</h3>
          <p id="notification-dialog-description">{details.description}</p>
          <p className="notification-dialog-note">Notifications are optional. They may appear on this device’s lock screen. You can turn them off at any time in Settings or your device or browser settings. Order and payment status in your dashboard remains the source of truth.</p>
          <div className="notification-dialog-actions">
            <button type="button" className="notification-dialog-secondary" onClick={closePrompt}>Not now</button>
            <button type="button" className="notification-dialog-primary" ref={confirmButtonRef} onClick={() => updateNotifications(false)}>Continue</button>
          </div>
        </section>
      </div>
    )}
  </div>
}

export default function NotificationControls() {
  const { user, profile } = useAuth()
  return user ? <UserNotificationControls key={user.uid} user={user} profile={profile} /> : null
}
