import { useEffect, useMemo, useRef, useState } from 'react'
import { attentionItems } from '../../utils/finance'

export function useFinanceAlerts(orders, uid) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  const alerts = useMemo(() => attentionItems(orders, now), [orders, now])
  const previous = useRef(null)
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  useEffect(() => {
    if (!uid || !orders.length) return
    const ids = new Set(alerts.map((item) => item.id))
    const fresh = previous.current ? alerts.filter((item) => !previous.current.has(item.id)) : []
    previous.current = ids
    if (permission !== 'granted' || !fresh.length) return
    let enabled = false
    try { enabled = localStorage.getItem('carenest-finance-notifications:' + uid) === 'yes' } catch { /* Storage can be unavailable. */ }
    if (!enabled) return
    const title = 'CareNest: transactions need attention'
    const options = { body: fresh.length + ' new item(s). Open the admin dashboard to review.', tag: 'carenest-finance-attention', icon: '/icon-192.png', data: { url: '/dashboard/admin?view=finance#finance-attention' } }
    async function show() {
      try {
        const registration = await navigator.serviceWorker?.getRegistration()
        if (registration) { await registration.showNotification(title, options); return }
        const notification = new Notification(title, options)
        notification.onclick = () => { window.focus(); window.location.assign(options.data.url); notification.close() }
      } catch { /* In-app alerts remain available if the browser cannot notify. */ }
    }
    void show()
  }, [alerts, orders.length, permission, uid])
  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') try { localStorage.setItem('carenest-finance-notifications:' + uid, 'yes') } catch { /* Keep in-app alerts available. */ }
  }
  return { alerts, permission, enableNotifications }
}
