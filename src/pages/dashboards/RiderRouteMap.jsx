import { FiNavigation } from 'react-icons/fi'
import GoogleMapCanvas from '../../components/GoogleMapCanvas'
import { googleMapsDirectionsUrl } from '../../utils/googleMapsLinks'
import './RiderRouteMap.css'

function RiderRouteMap({ orders, order, transportType, sharing, onShareLocation, onStopLocation, starting, onSelect }) {
  const point = (value) => {
    if (value?.lat == null || value?.lng == null) return null
    const lat = Number(value.lat)
    const lng = Number(value.lng)
    return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
      ? { lat, lng }
      : null
  }
  const riderLocation = point(order?.riderLocation)
  const pickup = point(order?.pickupCoordinates)
  const destination = point(order?.addressCoordinates)
  const hasRiderLocation = Boolean(riderLocation)
  const hasDestination = Boolean(destination)
  const mode = /foot|walk/i.test(transportType || '') ? 'walking' : /bicycle|cycle/i.test(transportType || '') ? 'bicycling' : 'driving'
  const directionsUrl = hasDestination
    ? googleMapsDirectionsUrl(destination, mode, riderLocation)
    : ''
  const mapMarkers = order ? [
    riderLocation && { orderId: order.firestoreId, kind: 'rider', position: riderLocation, label: 'R', title: `Your GPS position for ${order.id}` },
    pickup && { orderId: order.firestoreId, kind: 'pickup', position: pickup, label: 'P', title: `Pickup location for ${order.id}` },
    destination && { orderId: order.firestoreId, kind: 'destination', position: destination, label: 'D', title: `Delivery destination for ${order.id}` },
  ].filter(Boolean) : []
  const routeOrigin = riderLocation || pickup
  const route = routeOrigin && destination ? { origin: routeOrigin, destination, travelMode: mode } : null
  const updatedAt = order?.riderLocation?.updatedAt
  const lastUpdate = updatedAt?.toDate ? updatedAt.toDate() : updatedAt ? new Date(updatedAt) : null

  return (
    <section className="dashboard-panel rider-route-panel" aria-labelledby="rider-route-heading">
      <div className="dashboard-panel-header">
        <div><h2 id="rider-route-heading">Delivery route</h2><p>{order ? `${order.id} · ${order.address || 'Destination address unavailable'}` : 'Accept a delivery to view its route.'}</p></div>
        <div className="rider-route-controls">
          {orders.length > 0 && <select aria-label="Select delivery route" value={order?.firestoreId || ''} onChange={(event) => onSelect(event.target.value)}>{orders.map((delivery) => <option value={delivery.firestoreId} key={delivery.firestoreId}>{delivery.id} · {delivery.address || 'Address unavailable'}</option>)}</select>}
          {order && (sharing
            ? <button type="button" onClick={onStopLocation}>Stop sharing</button>
            : <button type="button" disabled={starting} onClick={onShareLocation}>{starting ? 'Starting…' : 'Share my location'}</button>)}
        </div>
      </div>
      <div className="rider-route-content">
        <div className="rider-route-map">
          <GoogleMapCanvas
            ariaLabel={order ? `Interactive route map to ${order.address || 'the destination'}` : 'Interactive delivery map'}
            markers={mapMarkers}
            selectedOrderId={order?.firestoreId}
            onMarkerSelect={onSelect}
            route={route}
            emptyMessage={order ? 'Verified delivery coordinates are not available.' : 'Accept a delivery to view its map.'}
          />
        </div>
        <aside className="rider-route-details">
          {order ? <>
            <div><span>Delivery</span><strong>{order.id}</strong></div>
            <div><span>Progress</span><strong>{order.riderStatus || order.status}</strong></div>
            <div><span>Location</span><strong>{hasRiderLocation ? 'GPS position available' : 'Not shared yet'}</strong></div>
            {hasRiderLocation && lastUpdate && !Number.isNaN(lastUpdate.getTime()) && <small>Last GPS update: {lastUpdate.toLocaleTimeString()}</small>}
            {directionsUrl ? <a href={directionsUrl} target="_blank" rel="noreferrer"><FiNavigation /> Open navigation</a> : <p>A verified destination pin is not available. Confirm the address with the customer before navigating.</p>}
          </> : <p>Your selected active delivery route will appear here. No location is shown until GPS sharing is enabled.</p>}
        </aside>
      </div>
    </section>
  )
}

export default RiderRouteMap