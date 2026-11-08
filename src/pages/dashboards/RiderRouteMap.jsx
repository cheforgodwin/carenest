import { FiMapPin, FiNavigation } from 'react-icons/fi'
import { googleMapsDirectionsUrl } from '../../utils/googleMapsLinks'
import './RiderRouteMap.css'

function RiderRouteMap({ orders, order, transportType, sharing, onShareLocation, onStopLocation, starting, onSelect }) {
  const hasRiderLocation = order?.riderLocation?.lat != null && order?.riderLocation?.lng != null
    && Number.isFinite(Number(order.riderLocation.lat)) && Number.isFinite(Number(order.riderLocation.lng))
  const hasDestination = order?.addressCoordinates?.lat != null && order?.addressCoordinates?.lng != null
    && Number.isFinite(Number(order.addressCoordinates.lat)) && Number.isFinite(Number(order.addressCoordinates.lng))
  const mode = /foot|walk/i.test(transportType || '') ? 'walking' : /bicycle|cycle/i.test(transportType || '') ? 'bicycling' : 'driving'
  const directionsUrl = hasDestination
    ? googleMapsDirectionsUrl(order.addressCoordinates, mode, hasRiderLocation ? order.riderLocation : null)
    : ''
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
        <div className="rider-route-map" role="img" aria-label={order ? `Schematic delivery route to ${order.address || 'the destination'}` : 'Map placeholder. No active delivery selected.'}>
          <div className="rider-map-grid" aria-hidden="true"><i className="rider-road road-a" /><i className="rider-road road-b" /><i className="rider-road road-c" /><i className="rider-road road-d" /><i className="rider-green-space green-a" /><i className="rider-green-space green-b" />
            {order && <><svg className="rider-map-route" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="27" y1="65" x2="76" y2="37" /></svg><span className="rider-route-pin destination"><FiMapPin /></span>{hasRiderLocation && <span className="rider-route-pin rider"><FiNavigation /></span>}</>}
          </div>
          <span className="rider-map-disclaimer">Schematic preview · not to scale</span>
          {order && <div className="rider-map-address"><strong>Destination</strong><span>{order.address || 'Address not provided'}</span></div>}
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