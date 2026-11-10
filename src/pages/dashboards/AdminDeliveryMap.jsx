import { FiMapPin, FiNavigation } from 'react-icons/fi'
import { googleMapsPointUrl } from '../../utils/googleMapsLinks'
import './AdminDeliveryMap.css'

function coordinates(point) {
  if (point?.lat == null || point?.lng == null) return null
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function formatUpdatedAt(value) {
  const date = value?.toDate
    ? value.toDate()
    : value?.seconds != null || value?._seconds != null
      ? new Date(Number(value.seconds ?? value._seconds) * 1000)
      : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Not available'
}

function AdminDeliveryMap({ orders, selectedOrderId, onSelect }) {
  const plotted = orders.flatMap((order) => [
    coordinates(order.riderLocation) && { order, kind: 'rider', point: coordinates(order.riderLocation) },
    coordinates(order.pickupCoordinates) && { order, kind: 'pickup', point: coordinates(order.pickupCoordinates) },
    coordinates(order.addressCoordinates) && { order, kind: 'destination', point: coordinates(order.addressCoordinates) },
  ].filter(Boolean))
  const latitudes = plotted.map(({ point }) => point.lat)
  const longitudes = plotted.map(({ point }) => point.lng)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)
  const project = (point) => ({
    x: maxLng === minLng ? 50 : 8 + ((point.lng - minLng) / (maxLng - minLng)) * 84,
    y: maxLat === minLat ? 50 : 92 - ((point.lat - minLat) / (maxLat - minLat)) * 84,
  })
  const selectedOrder = orders.find((order) => order.firestoreId === selectedOrderId) || orders[0] || null
  const locatedRiders = new Set(orders.filter((order) => coordinates(order.riderLocation) && order.riderUid).map((order) => order.riderUid)).size

  return (
    <div className="admin-delivery-layout">
      <div className="admin-delivery-map-wrap">
        <div className="admin-delivery-map" role="group" aria-label="Active delivery map">
          <div className="admin-map-art" aria-hidden="true"><i className="admin-map-road admin-road-a" /><i className="admin-map-road admin-road-b" /><i className="admin-map-road admin-road-c" /><i className="admin-map-road admin-road-d" /><i className="admin-map-green admin-green-a" /><i className="admin-map-green admin-green-b" />
            {orders.map((order) => {
              const rider = coordinates(order.riderLocation)
              const pickup = coordinates(order.pickupCoordinates)
              const destination = coordinates(order.addressCoordinates)
              const origin = pickup || rider
              if (!origin || !destination) return null
              const from = project(origin)
              const to = project(destination)
              return <svg className="admin-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" key={`route-${order.firestoreId}`}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /></svg>
            })}
          </div>
          {plotted.map(({ order, kind, point }) => {
            const position = project(point)
            const selected = order.firestoreId === selectedOrder?.firestoreId
            return <button
              type="button"
              className={`admin-map-marker ${kind}${selected ? ' selected' : ''}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              key={`${order.firestoreId}-${kind}`}
              onClick={() => onSelect(order.firestoreId)}
              aria-label={`${kind === 'rider' ? 'Rider position' : kind === 'pickup' ? 'Pickup location' : 'Delivery destination'} for ${order.id}, ${order.status}`}
              title={`${order.id} · ${kind === 'rider' ? 'Rider' : kind === 'pickup' ? 'Pickup' : 'Destination'}`}
            >{kind === 'rider' ? <FiNavigation /> : <FiMapPin />}</button>
          })}
          {!plotted.length && <div className="admin-map-empty"><FiMapPin /><strong>No location data yet</strong><span>Delivery pins appear when orders include verified coordinates.</span></div>}
          <span className="admin-map-scale-note">Coordinate overview · not a street map</span>
        </div>
        <div className="admin-map-legend"><span><i className="legend-rider" /> Rider GPS</span><span><i className="legend-pickup" /> Pickup</span><span><i className="legend-destination" /> Destination</span><b>{locatedRiders} rider(s) reporting location</b></div>
      </div>
      <aside className="admin-delivery-inspector" aria-live="polite">
        {selectedOrder ? <>
          <span className="admin-inspector-eyebrow">SELECTED DELIVERY</span>
          <h3>{selectedOrder.id}</h3>
          <span className={`status-chip ${String(selectedOrder.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{selectedOrder.status}</span>
          <dl>
            {selectedOrder.pickupAddress && <div><dt>Pickup</dt><dd>{selectedOrder.pickupAddress}</dd></div>}
            <div><dt>Destination</dt><dd>{selectedOrder.address || 'Not recorded'}</dd></div>
            <div><dt>Rider</dt><dd>{selectedOrder.riderName || 'Not assigned'}</dd></div>
            <div><dt>Payment</dt><dd>{selectedOrder.paymentStatus || selectedOrder.payment?.status || 'Pending'}</dd></div>
            <div><dt>Rider GPS</dt><dd>{coordinates(selectedOrder.riderLocation) ? formatUpdatedAt(selectedOrder.riderLocation.updatedAt) : 'No live position'}</dd></div>
          </dl>
          {coordinates(selectedOrder.addressCoordinates) && <a className="admin-map-directions" href={googleMapsPointUrl(selectedOrder.addressCoordinates)} target="_blank" rel="noreferrer"><FiNavigation /> Open destination</a>}
        </> : <p>Select a delivery marker to inspect its current status.</p>}
      </aside>
    </div>
  )
}

export default AdminDeliveryMap