import { useEffect, useState } from 'react'

function readNetworkStatus() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType || '',
    saveData: Boolean(connection?.saveData),
  }
}

export default function useNetworkStatus() {
  const [status, setStatus] = useState(readNetworkStatus)

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const updateStatus = () => setStatus(readNetworkStatus())

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    connection?.addEventListener?.('change', updateStatus)

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
      connection?.removeEventListener?.('change', updateStatus)
    }
  }, [])

  return {
    ...status,
    slow: status.saveData || ['slow-2g', '2g'].includes(status.effectiveType),
  }
}
