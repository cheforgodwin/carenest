import { FiRefreshCw, FiWifiOff } from 'react-icons/fi'
import useNetworkStatus from '../hooks/useNetworkStatus'

export default function NetworkStatus() {
  const { online, slow } = useNetworkStatus()

  if (online && !slow) return null

  return (
    <aside className={`network-status ${online ? 'slow' : 'offline'}`} role="status" aria-live="polite">
      <FiWifiOff aria-hidden="true" />
      <span>
        <strong>{online ? 'Slow connection' : 'You are offline'}</strong>
        <small>{online ? 'CareNest will use less data. Some updates may take longer.' : 'You can view loaded pages, but reconnect before booking or paying.'}</small>
      </span>
      <button type="button" onClick={() => window.location.reload()} title="Try connection again" aria-label="Try connection again">
        <FiRefreshCw aria-hidden="true" />
      </button>
    </aside>
  )
}
