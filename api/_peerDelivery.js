import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'

export const peerDeliveryStatuses = [
  'pending_registration', 'awaiting_recipient', 'awaiting_payment', 'searching_rider',
  'rider_assigned', 'rider_to_pickup', 'rider_arrived_pickup', 'package_picked_up',
  'in_transit', 'near_destination', 'delivered', 'declined', 'cancelled', 'failed_delivery',
]
export const peerDeliveryPackageCategories = [
  'Documents', 'Clothing', 'Electronics', 'Permitted food', 'Household items',
  'Personal belongings', 'Other permitted items',
]

const terminalStatuses = new Set(['delivered', 'declined', 'cancelled', 'failed_delivery'])
const transitions = {
  pending_registration: ['awaiting_recipient', 'cancelled'],
  awaiting_recipient: ['awaiting_payment', 'declined', 'cancelled'],
  awaiting_payment: ['searching_rider', 'cancelled'],
  searching_rider: ['rider_assigned', 'cancelled'],
  rider_assigned: ['rider_to_pickup', 'searching_rider', 'cancelled'],
  rider_to_pickup: ['rider_arrived_pickup', 'searching_rider', 'cancelled'],
  rider_arrived_pickup: ['package_picked_up', 'searching_rider', 'cancelled'],
  package_picked_up: ['in_transit', 'failed_delivery'],
  in_transit: ['near_destination', 'delivered', 'failed_delivery'],
  near_destination: ['delivered', 'failed_delivery'],
  delivered: [], declined: [], cancelled: [], failed_delivery: [],
}

export function deliveryError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

export function normalizeCameroonPhone(value) {
  const digits = String(value || '').replace(/[\s()-]/g, '')
  const normalized = digits.startsWith('00') ? '+' + digits.slice(2) : digits.startsWith('+') ? digits : '+237' + digits.replace(/^0/, '')
  return /^\+2376\d{8}$/.test(normalized) ? normalized : ''
}

export function coordinates(value) {
  if (value?.lat == null || value?.lng == null) return null
  const lat = Number(value.lat)
  const lng = Number(value.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
}

export function assertPhoneClaim(user, expectedPhone) {
  const claimPhone = normalizeCameroonPhone(user?.phone_number)
  if (!claimPhone || claimPhone !== normalizeCameroonPhone(expectedPhone)) {
    throw deliveryError('Verify this Cameroon phone number with your CareNest account before continuing.', 403)
  }
  return claimPhone
}

export function assertTransition(before, after) {
  if (!peerDeliveryStatuses.includes(before) || !transitions[before]?.includes(after)) {
    throw deliveryError('This delivery status transition is not allowed.', 409)
  }
  return after
}

export function isTerminalDeliveryStatus(status) {
  return terminalStatuses.has(status)
}

export function makeDeliveryId() {
  return 'PD-' + randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()
}

export function makeOtp() {
  return String(randomInt(100000, 1000000))
}

export function hashSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function hashPrivateValue(value) {
  const key = String(process.env.PEER_DELIVERY_PHONE_HASH_SECRET || '')
  if (key.length < 32) throw deliveryError('Private phone verification is not configured.', 503)
  return createHmac('sha256', key).update(String(value)).digest('hex')
}

export function makeInvitationToken() {
  return randomBytes(32).toString('base64url')
}

function configuredInteger(name, minimum = 0) {
  const value = Number(process.env[name])
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw deliveryError(`Delivery pricing is not configured (${name}).`, 503)
  }
  return value
}

function straightLineKm(from, to) {
  const radians = (value) => value * Math.PI / 180
  const deltaLat = radians(to.lat - from.lat)
  const deltaLng = radians(to.lng - from.lng)
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function calculatePeerDeliveryQuote({ pickup, destination, weightKg = 0 }) {
  const origin = coordinates(pickup)
  const target = coordinates(destination)
  if (!origin || !target) throw deliveryError('Choose valid pickup and destination coordinates before requesting a quote.', 400)
  const baseFee = configuredInteger('PEER_DELIVERY_BASE_FEE_XAF', 1)
  const perKmFee = configuredInteger('PEER_DELIVERY_PER_KM_XAF', 0)
  const perKgFee = configuredInteger('PEER_DELIVERY_PER_KG_XAF', 0)
  const estimateFactor = Number(process.env.PEER_DELIVERY_STRAIGHT_LINE_FACTOR || 1.35)
  const speedKmh = Number(process.env.PEER_DELIVERY_ESTIMATED_SPEED_KMH || 20)
  if (!Number.isFinite(estimateFactor) || estimateFactor < 1 || estimateFactor > 3 || !Number.isFinite(speedKmh) || speedKmh < 5 || speedKmh > 80) {
    throw deliveryError('Delivery routing estimate configuration is invalid.', 503)
  }
  const weight = Number(weightKg || 0)
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw deliveryError('Enter a valid package weight.', 400)
  const straightDistance = straightLineKm(origin, target)
  const distanceKm = Math.max(0.1, Math.round(straightDistance * estimateFactor * 10) / 10)
  const deliveryFee = Math.ceil((baseFee + distanceKm * perKmFee + weight * perKgFee) / 100) * 100
  return {
    distanceKm,
    estimatedDurationMinutes: Math.max(15, Math.ceil(distanceKm / speedKmh * 60 / 5) * 5 + 10),
    deliveryFee,
    currency: 'XAF',
    estimateMethod: 'straight_line_factor',
    quotedAt: FieldValue.serverTimestamp(),
  }
}

export function safeDeliverySummary(delivery, id) {
  return {
    id,
    deliveryType: 'peer_to_peer',
    status: delivery.status,
    senderName: delivery.senderName || null,
    pickup: delivery.pickup,
    destination: delivery.destination,
    package: delivery.package,
    pricing: delivery.pricing || null,
    payment: delivery.payment ? {
      amount: delivery.payment.amount || 0,
      currency: 'XAF',
      status: delivery.payment.status,
    } : null,
    riderId: delivery.riderId || null,
    riderName: delivery.riderName || null,
    riderLocation: delivery.tracking?.lastLatitude != null && delivery.tracking?.lastLongitude != null
      ? { lat: delivery.tracking.lastLatitude, lng: delivery.tracking.lastLongitude, updatedAt: delivery.tracking.lastUpdatedAt || null }
      : null,
    recipientAcceptance: { status: delivery.recipientAcceptance?.status || 'pending' },
    createdAt: delivery.createdAt || null,
    updatedAt: delivery.updatedAt || null,
    completedAt: delivery.completedAt || null,
  }
}

export function auditDelivery(transaction, db, deliveryId, actor, action, before, after, details = {}) {
  const auditRef = db.collection('peerDeliveryAudit').doc()
  transaction.create(auditRef, {
    deliveryId,
    actorUid: actor.uid,
    actorRole: actor.role,
    action,
    fromStatus: before,
    toStatus: after,
    details,
    createdAt: FieldValue.serverTimestamp(),
  })
}
