import { useEffect, useState } from 'react'
import './AppUpdates.css'

export default function AppUpdates() {
  const [registration, setRegistration] = useState(null)
  const [applying, setApplying] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || window.location.origin !== 'https://carenest237.com') return
    let disposed = false
    let current
    let reloading = false
    let activatedByUser = false
    let hasController = Boolean(navigator.serviceWorker.controller)
    let installing
    const showUpdate = () => {
      if (!disposed && current?.waiting && navigator.serviceWorker.controller) setRegistration(current)
    }
    const stateChanged = () => { if (installing?.state === 'installed') showUpdate() }
    const updateFound = () => {
      installing?.removeEventListener('statechange', stateChanged)
      installing = current.installing
      installing?.addEventListener('statechange', stateChanged)
    }
    const controllerChanged = () => {
      if (!hasController) { hasController = true; return }
      if (activatedByUser && !reloading) { reloading = true; window.location.reload() }
      else if (navigator.serviceWorker.controller && current) setRegistration(current)
    }
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) current?.update().catch(() => {})
    }
    const activate = () => { activatedByUser = true }
    window.addEventListener('carenest:apply-update', activate)
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((value) => {
      if (disposed) return
      current = value
      showUpdate()
      current.addEventListener('updatefound', updateFound)
      if (current.installing) updateFound()
      check()
    }).catch(() => {})
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    const interval = window.setInterval(check, 5 * 60 * 1000)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      window.removeEventListener('carenest:apply-update', activate)
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
      current?.removeEventListener('updatefound', updateFound)
      installing?.removeEventListener('statechange', stateChanged)
    }
  }, [])
  if (!registration) return null
  return <aside className="app-update-notice" role="status">
    <div><strong>A CareNest update is ready</strong><p>Finish any booking or payment, then refresh. No reinstall needed.</p></div>
    <button type="button" disabled={applying} onClick={() => {
      setApplying(true)
      window.dispatchEvent(new Event('carenest:apply-update'))
      if (registration.waiting) registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' })
      else window.location.reload()
    }}>{applying ? 'Updating...' : 'Update now'}</button>
  </aside>
}
