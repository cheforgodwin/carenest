import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  assignServiceRequestToRider,
  subscribeToOpenRiderDeliveries,
  subscribeToRiderOrders,
  updateRiderDeliveryStatus,
} from '../../firebase/orderService'
import DashboardShell from './DashboardShell'

function normalizeStatus(status) {
  return String(status || 'Pending').toLowerCase().replace(/\s+/g, '-')
}

function getDeliveryErrorMessage(error) {
  if (error?.code === 'failed-precondition' || error?.message?.includes('requires an index')) {
    return 'Deliveries could not be loaded right now. Please try again shortly.'
  }
  return error?.message || 'Something went wrong while loading deliveries.'
}
function RiderDashboardPage() {
  const [searchParams] = useSearchParams()
  const activeView = searchParams.get('view') || 'overview'
  const { profile, user } = useAuth()
  const [availableDeliveries, setAvailableDeliveries] = useState([])
  const [assignedDeliveries, setAssignedDeliveries] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const unsubOpen = subscribeToOpenRiderDeliveries(
      setAvailableDeliveries,
      (nextError) => setError(getDeliveryErrorMessage(nextError)),
    )
    const unsubAssigned = subscribeToRiderOrders(
      user?.uid,
      setAssignedDeliveries,
      (nextError) => setError(getDeliveryErrorMessage(nextError)),
    )

    return () => {
      unsubOpen()
      unsubAssigned()
    }
  }, [user?.uid])

  const activeAssigned = assignedDeliveries.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const completed = assignedDeliveries.filter((order) => order.status === 'Completed')

  const metrics = [
    ['Open deliveries', String(availableDeliveries.length)],
    ['Assigned deliveries', String(activeAssigned.length)],
    ['Completed deliveries', String(completed.length)],
  ]

  const nav = [
    { label: 'Overview', to: '/dashboard/rider?view=overview', icon: 'dashboard' },
    { label: 'Deliveries', to: '/dashboard/rider?view=deliveries', icon: 'bookings' },
    { label: 'Completed', to: '/dashboard/rider?view=completed', icon: 'users' },
  ]

  const needle = query.trim().toLowerCase()
  const visibleAvailable = availableDeliveries.filter((order) => {
    const haystack = [order.id, order.customerName, order.address, order.service, order.status].join(' ').toLowerCase()
    return !needle || haystack.includes(needle)
  })
  const visibleAssigned = activeAssigned.filter((order) => {
    const haystack = [order.id, order.customerName, order.address, order.service, order.status].join(' ').toLowerCase()
    return !needle || haystack.includes(needle)
  })
  const visibleCompleted = completed.filter((order) => {
    const haystack = [order.id, order.customerName, order.address, order.service, order.status].join(' ').toLowerCase()
    return !needle || haystack.includes(needle)
  })

  async function acceptDelivery(order) {
    setError('')
    setMessage('')
    try {
      await assignServiceRequestToRider(order.firestoreId, {
        uid: user.uid,
        name: profile?.name || user.displayName || 'Rider',
        phone: profile?.phone || '',
      })
      setMessage(`Delivery ${order.id} assigned to you.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function updateStatus(order, status) {
    setError('')
    setMessage('')
    try {
      await updateRiderDeliveryStatus(order.firestoreId, status)
      setMessage(`${order.id} marked ${status.toLowerCase()}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  return (
    <DashboardShell
      title="Rider Dashboard"
      subtitle="Accept delivery jobs and update pickup and delivery progress."
      action={{ label: 'View available deliveries', href: '/dashboard/rider?view=deliveries' }}
      nav={nav}
      metrics={metrics}
    >
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>{activeView === 'completed' ? 'Completed deliveries' : activeView === 'deliveries' ? 'Your delivery jobs' : 'Rider overview'}</h2>
            <p>{activeView === 'deliveries'
              ? 'Accept available delivery jobs and update their pickup or delivery status.'
              : activeView === 'completed'
                ? 'Review deliveries you have completed.'
                : 'Track available delivery requests and the jobs assigned to you.'}
            </p>
          </div>
          <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deliveries" />
        </div>

        {activeView === 'overview' && (
          <div className="dashboard-simple-list">
            <div className="dashboard-summary-card">
              <h3>Available deliveries</h3>
              <p>{availableDeliveries.length} jobs waiting for pickup</p>
            </div>
            <div className="dashboard-summary-card">
              <h3>Assigned deliveries</h3>
              <p>{activeAssigned.length} jobs currently in your route</p>
            </div>
            <div className="dashboard-summary-card">
              <h3>Completed deliveries</h3>
              <p>{completed.length} finished jobs</p>
            </div>
          </div>
        )}

        {(activeView === 'deliveries' || activeView === 'completed') && (
          <table className="dashboard-table">
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Service</th><th>Status</th><th>Address</th><th>Pickup</th><th>Action</th></tr>
            </thead>
            <tbody>
              {(activeView === 'deliveries' ? visibleAssigned : visibleCompleted).map((order) => (
                <tr key={order.firestoreId}>
                  <td>{order.id}</td>
                  <td>{order.customerName || 'Customer'}</td>
                  <td>{order.service}</td>
                  <td><span className={`status-chip ${normalizeStatus(order.riderStatus || order.status)}`}>{order.riderStatus || order.status}</span></td>
                  <td>{order.address}</td>
                  <td>{order.pickupDate || order.pickupTime ? `${order.pickupDate || ''}${order.pickupTime ? ` ${order.pickupTime}` : ''}` : 'Not set'}</td>
                  <td>
                    {activeView === 'deliveries' ? (
                      <div className="table-action-row">
                        <button className="table-action" type="button" onClick={() => updateStatus(order, 'Picked up')}>Picked up</button>
                        <button className="table-action" type="button" onClick={() => updateStatus(order, 'Delivered')}>Delivered</button>
                      </div>
                    ) : (
                      <span>{order.status === 'Completed' ? 'Done' : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeView === 'deliveries' && visibleAssigned.length === 0 && <p className="dashboard-empty">No assigned deliveries yet. Check available jobs in the overview.</p>}
        {activeView === 'completed' && visibleCompleted.length === 0 && <p className="dashboard-empty">No completed deliveries yet.</p>}
      </section>

      {activeView === 'overview' && availableDeliveries.length > 0 && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Available delivery jobs</h2>
              <p>Pick the job you want and accept it to start the delivery.</p>
            </div>
          </div>
          {visibleAvailable.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>Address</th><th>Pickup time</th><th>Action</th></tr></thead>
              <tbody>
                {visibleAvailable.map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.customerName || 'Customer'}</td>
                    <td>{order.service}</td>
                    <td>{order.address}</td>
                    <td>{order.pickupDate || order.pickupTime ? `${order.pickupDate || ''}${order.pickupTime ? ` ${order.pickupTime}` : ''}` : 'Not set'}</td>
                    <td><button className="table-action" type="button" onClick={() => acceptDelivery(order)}>Accept</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dashboard-empty">No open delivery jobs are available right now.</p>
          )}
        </section>
      )}
    </DashboardShell>
  )
}

export default RiderDashboardPage
