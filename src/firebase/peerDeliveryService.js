import { postJson } from '../utils/networkUtils'

const refreshEvent = 'carenest-peer-delivery-update'

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
    destinationInstructions: destination.instructions || '',
    addressCoordinates: mapPoint(destination),
    pickupAddress: pickup.address || pickup.landmark || 'Address not recorded',
    pickupInstructions: pickup.instructions || '',
    pickupCoordinates: mapPoint(pickup),
    packageCategory: delivery.package?.category || '',
    packageDescription: delivery.package?.description || '',
    riderUid: delivery.riderId || '',
    hasRider: delivery.hasRider ?? Boolean(delivery.riderId),
    riderName: delivery.riderName || '',
    riderLocation,
    paymentStatus: ({ paid: 'Paid', submitted: 'Submitted', failed: 'Failed' })[delivery.payment?.status] || delivery.payment?.status || 'Not paid',
    canPay: delivery.canPay === true,
    currentUserRole: delivery.currentUserRole || '',
    createdAt: delivery.createdAt || null,
  }
}

export function requestPeerDelivery(body) {
  return postJson('/api/peer-delivery', body)
}

export function notifyPeerDeliveryUpdate() {
  window.dispatchEvent(new Event(refreshEvent))
}

function subscribeToPeerDeliveries(action, onNext, onError) {
  let stopped = false
  let timer

  const refresh = async () => {
    try {
      const result = await requestPeerDelivery({ action })
      if (!Array.isArray(result.deliveries)) throw new Error('The peer-delivery response was invalid.')
      if (!stopped) onNext(result.deliveries.map(normalizePeerDeliveryForMap))
    } catch (error) {
      if (!stopped) onError(error)
    }
    if (!stopped) timer = setTimeout(refresh, 30000)
  }

  const wake = () => {
    if (document.visibilityState !== 'visible') return
    clearTimeout(timer)
    if (!stopped) refresh()
  }
  window.addEventListener(refreshEvent, wake)
  document.addEventListener('visibilitychange', wake)
  refresh()
  return () => {
    stopped = true
    clearTimeout(timer)
    window.removeEventListener(refreshEvent, wake)
    document.removeEventListener('visibilitychange', wake)
  }
}

export const subscribeToAdminPeerDeliveries = (onNext, onError) => subscribeToPeerDeliveries('list', onNext, onError)
export const subscribeToMyPeerDeliveries = (onNext, onError) => subscribeToPeerDeliveries('listMine', onNext, onError)
export const subscribeToRiderPeerDeliveries = (onNext, onError) => subscribeToPeerDeliveries('listRider', onNext, onError)
