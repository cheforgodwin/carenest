import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import {
  assignServiceRequestToRider,
  subscribeToOpenRiderDeliveries,
  subscribeToRiderOrders,
  updateRiderDeliveryStatus,
  updateRiderLiveLocation,
  clearRiderLiveLocation,
} from '../../firebase/orderService'
import { googleMapsDirectionsUrl } from '../../utils/googleMapsLinks'
import DashboardShell from './DashboardShell'
import { DashboardRowSkeleton, Skeleton } from '../../components/ContentSkeletons'

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
  const [availableDeliveriesLoading, setAvailableDeliveriesLoading] = useState(true)
  const [assignedDeliveriesLoading, setAssignedDeliveriesLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [sharingOrderId, setSharingOrderId] = useState('')
  const [startingOrderId, setStartingOrderId] = useState('')
  const watchIdRef = useRef(null)
  const sharingOrderRef = useRef('')
  const lastLocationRef = useRef(null)
  const writingLocationRef = useRef(false)

  useEffect(() => {
    const unsubOpen = subscribeToOpenRiderDeliveries(
      (deliveries) => {
        setAvailableDeliveries(deliveries)
        setAvailableDeliveriesLoading(false)
      },
      (nextError) => {
        setError(getDeliveryErrorMessage(nextError))
        setAvailableDeliveriesLoading(false)
      },
    )
    const unsubAssigned = subscribeToRiderOrders(
      user?.uid,
      (deliveries) => {
        setAssignedDeliveries(deliveries)
        setAssignedDeliveriesLoading(false)
        const trackingOrder = deliveries.find((order) => order.firestoreId === sharingOrderRef.current && order.status === 'Out for Delivery')
        if (sharingOrderRef.current && !trackingOrder) {
          if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current)
          watchIdRef.current = null
          sharingOrderRef.current = ''
          setSharingOrderId('')
        }
      },
      (nextError) => {
        setError(getDeliveryErrorMessage(nextError))
        setAssignedDeliveriesLoading(false)
      },
    )

    return () => {
      unsubOpen()
      unsubAssigned()
    }
  }, [user?.uid])

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current)
  }, [])

  const activeAssigned = assignedDeliveries.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const completed = assignedDeliveries.filter((order) => order.status === 'Completed')
  const metrics = [
    ['Open deliveries', availableDeliveriesLoading ? <Skeleton className="dashboard-metric-skeleton" /> : String(availableDeliveries.length)],
    ['Assigned deliveries', assignedDeliveriesLoading ? <Skeleton className="dashboard-metric-skeleton" /> : String(activeAssigned.length)],
    ['Completed deliveries', assignedDeliveriesLoading ? <Skeleton className="dashboard-metric-skeleton" /> : String(completed.length)],
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

  async function startLocationSharing(order) {
    if (!navigator.geolocation) { setError('Location sharing needs a browser that supports location.'); return }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    setStartingOrderId(order.firestoreId); setError(''); setMessage('')
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 }))
      const initial = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }
      await updateRiderLiveLocation(order.firestoreId, initial)
      const now = Date.now()
      lastLocationRef.current = { ...initial, sentAt: now }
      sharingOrderRef.current = order.firestoreId
      setSharingOrderId(order.firestoreId)
      setMessage('Location sharing is on for ' + order.id + '. It updates after you move about 50 m or once a minute.')
      watchIdRef.current = navigator.geolocation.watchPosition((nextPosition) => {
        const next = { lat: nextPosition.coords.latitude, lng: nextPosition.coords.longitude, accuracy: nextPosition.coords.accuracy }
        const previous = lastLocationRef.current
        const radians = (value) => value * Math.PI / 180
        const dLat = radians(next.lat - previous.lat)
        const dLng = radians(next.lng - previous.lng)
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(previous.lat)) * Math.cos(radians(next.lat)) * Math.sin(dLng / 2) ** 2
        const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        if (writingLocationRef.current || (distance < 50 && Date.now() - previous.sentAt < 60000)) return
        writingLocationRef.current = true
        updateRiderLiveLocation(order.firestoreId, next).then(() => {
          lastLocationRef.current = { ...next, sentAt: Date.now() }
        }).catch((locationError) => setError(locationError.message || 'Location update failed.')).finally(() => { writingLocationRef.current = false })
      }, (locationError) => setError(locationError.code === 1 ? 'Location permission was turned off.' : 'Could not update your current location.'), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 })
    } catch (locationError) {
      setError(locationError.code === 1 ? 'Allow location access to share your delivery position.' : locationError.message || 'Could not start location sharing.')
    } finally { setStartingOrderId('') }
  }

  async function stopLocationSharing(order) {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    sharingOrderRef.current = ''
    lastLocationRef.current = null
    setSharingOrderId('')
    try {
      await clearRiderLiveLocation(order.firestoreId)
      setMessage('Location sharing stopped for ' + order.id + '.')
    } catch (stopError) { setError(stopError.message || 'Could not stop location sharing.') }
  }

  async function updateStatus(order, status) {
    setError('')
    setMessage('')
    try {
      await updateRiderDeliveryStatus(order.firestoreId, status)
      if (status === 'Delivered' && sharingOrderRef.current === order.firestoreId) {
        if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null; sharingOrderRef.current = ''; setSharingOrderId('')
      }
      setMessage(status === 'Delivered' ? 'Delivery reported. Waiting for the customer to confirm receipt.' : `${order.id} marked ${status.toLowerCase()}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  return (
    <DashboardShell
      title="Rider Dashboard"
      subtitle={'Delivery work: ' + (profile?.riderProfile?.transportType || 'transport mode not set') + '. Update pickup and delivery progress.'}
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
              {availableDeliveriesLoading ? <Skeleton className="skeleton-line skeleton-line-long" /> : <p>{availableDeliveries.length} jobs waiting for pickup</p>}
            </div>
            <div className="dashboard-summary-card">
              <h3>Assigned deliveries</h3>
              {assignedDeliveriesLoading ? <Skeleton className="skeleton-line skeleton-line-long" /> : <p>{activeAssigned.length} jobs currently in your route</p>}
            </div>
            <div className="dashboard-summary-card">
              <h3>Completed deliveries</h3>
              {assignedDeliveriesLoading ? <Skeleton className="skeleton-line skeleton-line-long" /> : <p>{completed.length} finished jobs</p>}
            </div>
          </div>
        )}

        {(activeView === 'deliveries' || activeView === 'completed') && (
          <table className="dashboard-table">
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Service</th><th>Status</th><th>Address</th><th>Pickup</th><th>Action</th></tr>
            </thead>
            <tbody>
              {assignedDeliveriesLoading
                ? Array.from({ length: 4 }, (_, index) => <tr key={index}><td colSpan="7"><DashboardRowSkeleton columns={7} /></td></tr>)
                : (activeView === 'deliveries' ? visibleAssigned : visibleCompleted).map((order) => (
                <tr key={order.firestoreId}>
                  <td>{order.id}</td>
                  <td>{order.customerName || 'Customer'}</td>
                  <td>{order.service}</td>
                  <td><span className={`status-chip ${normalizeStatus(order.riderStatus || order.status)}`}>{order.riderStatus || order.status}</span></td>
                  <td>{order.address}{order.addressCoordinates && <small><a href={googleMapsDirectionsUrl(order.addressCoordinates, /foot|walk/i.test(profile?.riderProfile?.transportType || '') ? 'walking' : /bicycle|cycle/i.test(profile?.riderProfile?.transportType || '') ? 'bicycling' : 'driving', order.riderLocation)} target="_blank" rel="noreferrer">Open { /foot|walk/i.test(profile?.riderProfile?.transportType || '') ? 'walking' : 'delivery' } directions</a></small>}</td>
                  <td>{order.pickupDate || order.pickupTime ? `${order.pickupDate || ''}${order.pickupTime ? ` ${order.pickupTime}` : ''}` : 'Not set'}</td>
                  <td>
                    {activeView === 'deliveries' && !['Awaiting confirmation', 'Completed', 'Complaint', 'Cancelled'].includes(order.status) ? (
                      <div className="table-action-row">
                        <button className="table-action" type="button" disabled={order.paymentStatus !== 'Paid' || order.riderStatus !== 'Accepted'} onClick={() => updateStatus(order, 'Picked up')}>Picked up</button>
                        <button className="table-action" type="button" disabled={order.paymentStatus !== 'Paid' || order.riderStatus !== 'Picked up'} onClick={() => updateStatus(order, 'Delivered')}>Delivered</button>
                        {sharingOrderId === order.firestoreId ? <button className="table-action secondary" type="button" onClick={() => stopLocationSharing(order)}>Stop location sharing</button> : <button className="table-action secondary" type="button" disabled={Boolean(sharingOrderId) || Boolean(startingOrderId) || order.paymentStatus !== 'Paid'} onClick={() => startLocationSharing(order)}>{startingOrderId === order.firestoreId ? 'Starting...' : 'Share my location'}</button>}
                      </div>
                    ) : (
                      <span>{order.status === 'Completed' ? 'Confirmed' : order.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeView === 'deliveries' && !assignedDeliveriesLoading && visibleAssigned.length === 0 && <p className="dashboard-empty">No assigned deliveries yet. Check available jobs in the overview.</p>}
        {activeView === 'completed' && !assignedDeliveriesLoading && visibleCompleted.length === 0 && <p className="dashboard-empty">No completed deliveries yet.</p>}
      </section>

      {activeView === 'overview' && (availableDeliveriesLoading || availableDeliveries.length > 0) && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Available delivery jobs</h2>
              <p>Pick the job you want and accept it to start the delivery.</p>
            </div>
          </div>
          {availableDeliveriesLoading ? (
            <div className="dashboard-table-skeleton" aria-label="Loading deliveries">
              {Array.from({ length: 4 }, (_, index) => <DashboardRowSkeleton key={index} columns={6} />)}
            </div>
          ) : visibleAvailable.length > 0 ? (
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
