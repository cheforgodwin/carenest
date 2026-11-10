import { postJson } from '../utils/networkUtils'

function mapPoint(point) {
  if (!point) return null
  const coordinates = point.coordinates || point
  const lat = Number(coordinates.lat ?? coordinates.latitude)
  const lng = Number(coordinates.lng ?? coordinates.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
}

export function normalizePeerDeliveryForMap(delivery) {
  const destination = delivery.destination || {}
  const pickup = delivery.pickup || {}
  const riderLocation = mapPoint(delivery.riderLocation)
  if (riderLocation && delivery.riderLocation.updatedAt) riderLocation.updatedAt = delivery.riderLocation.updatedAt
  const firestoreId = `peer-${delivery.id}`
  const status = String(delivery.status || 'pending_registration')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  return {
    firestoreId,
    id: delivery.id,
    deliveryType: 'peer_to_peer',
    serviceType: 'delivery',
    status,
    address: destination.address || destination.landmark || 'Address not recorded',
    addressCoordinates: mapPoint(destination),
    pickupAddress: pickup.address || pickup.landmark || 'Address not recorded',
    pickupCoordinates: mapPoint(pickup),
    riderUid: delivery.riderId || '',
    riderName: delivery.riderName || '',
    riderLocation,
    paymentStatus: delivery.payment?.status || 'Not paid',
    createdAt: delivery.createdAt || null,
  }
}

export function subscribeToAdminPeerDeliveries(onNext, onError) {
  let stopped = false
  let timer

  const refresh = async () => {
    try {
      const result = await postJson('/api/peer-delivery', { action: 'list' })
      if (!Array.isArray(result.deliveries)) throw new Error('The peer-delivery response was invalid.')
      if (!stopped) onNext(result.deliveries.map(normalizePeerDeliveryForMap))
    } catch (error) {
      if (!stopped) onError(error)
    }
    if (!stopped) timer = setTimeout(refresh, 30000)
  }

  refresh()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
