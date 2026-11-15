import { useState } from 'react'
import { FiNavigation } from 'react-icons/fi'
import GoogleMapCanvas from '../../components/GoogleMapCanvas'
import { googleMapsPointUrl } from '../../utils/googleMapsLinks'
import './AdminDeliveryMap.css'

function coordinates(point) {
  if (point?.lat == null || point?.lng == null) return null
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
}

function formatUpdatedAt(value) {
  const date = value?.toDate
    ? value.toDate()
    : value?.seconds != null || value?._seconds != null
      ? new Date(Number(value.seconds ?? value._seconds) * 1000)
      : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Not available'
}

function AdminDeliveryMap({ orders, selectedOrderId, onSelect, riders = [], onAssignRider, assigningDeliveryId = '' }) {
  const [riderSelection, setRiderSelection] = useState('')
  const selectedOrder = orders.find((order) => order.firestoreId === selectedOrderId) || orders[0] || null
  const plotted = orders.flatMap((order) => [
    { kind: 'rider', position: coordinates(order.riderLocation), label: 'R', name: 'Rider position' },
    { kind: 'pickup', position: coordinates(order.pickupCoordinates), label: 'P', name: 'Pickup location' },
    { kind: 'destination', position: coordinates(order.addressCoordinates), label: 'D', name: 'Delivery destination' },
  ].filter(({ position }) => position).map(({ kind, position, label, name }) => ({
    orderId: order.firestoreId,
    kind,
    position,
    label,
    selected: order.firestoreId === selectedOrder?.firestoreId,
    title: `${name} for ${order.id}`,
  })))
  const locatedRiders = new Set(orders.filter((order) => coordinates(order.riderLocation) && order.riderUid).map((order) => order.riderUid)).size
  const selectedPickup = coordinates(selectedOrder?.pickupCoordinates)
  const selectedRider = coordinates(selectedOrder?.riderLocation)
  const selectedDestination = coordinates(selectedOrder?.addressCoordinates)
  const riderMode = riders.find((rider) => rider.uid === selectedOrder?.riderUid)?.riderProfile?.transportType || ''
  const travelMode = /foot|walk/i.test(riderMode) ? 'walking' : /bicycle|cycle/i.test(riderMode) ? 'bicycling' : 'driving'
  const routeOrigin = selectedRider || selectedPickup

  return (
    <div className="admin-delivery-layout">
      <div className="admin-delivery-map-wrap">
        <div className="admin-delivery-map">
          <GoogleMapCanvas
            ariaLabel="Interactive active delivery map"
            markers={plotted}
            selectedOrderId={selectedOrder?.firestoreId}
            onMarkerSelect={onSelect}
            route={routeOrigin && selectedDestination ? { origin: routeOrigin, destination: selectedDestination, travelMode } : null}
            emptyMessage="No location data yet. Pins appear when orders include verified coordinates."
          />
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
          {selectedOrder.deliveryType === 'peer_to_peer' && selectedOrder.status === 'Searching Rider' && <div className="admin-peer-rider-assignment">
            <label htmlFor="peer-delivery-rider">Assign approved rider</label>
            <select id="peer-delivery-rider" value={riderSelection} onChange={(event) => setRiderSelection(event.target.value)}>
              <option value="">Choose rider</option>
              {riders.filter((rider) => rider.riderVerified).map((rider) => <option value={rider.uid} key={rider.uid}>{rider.name || rider.email} · {rider.riderProfile?.transportType || 'transport not set'}</option>)}
            </select>
            <button type="button" className="table-action" disabled={!riderSelection || assigningDeliveryId === selectedOrder.firestoreId} onClick={() => onAssignRider?.(selectedOrder, riderSelection)}>
              {assigningDeliveryId === selectedOrder.firestoreId ? 'Assigning...' : 'Assign rider'}
            </button>
          </div>}
          {selectedDestination && <a className="admin-map-directions" href={googleMapsPointUrl(selectedDestination)} target="_blank" rel="noreferrer"><FiNavigation /> Open destination</a>}
        </> : <p>Select a delivery marker to inspect its current status.</p>}
      </aside>
    </div>
  )
}

export default AdminDeliveryMap