import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { detectPaymentNetwork, normalizePaymentPhone, unsupportedPaymentPhoneMessage } from '../src/utils/paymentNetwork.js'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import {
  assertPhoneClaim,
  assertTransition,
  auditDelivery,
  calculatePeerDeliveryQuote,
  coordinates,
  deliveryError,
  hashPrivateValue,
  hashSecret,
  isTerminalDeliveryStatus,
  makeDeliveryId,
  makeInvitationToken,
  normalizeCameroonPhone,
  peerDeliveryPackageCategories,
  safeDeliverySummary,
} from './_peerDelivery.js'
import { applyVerifiedPeerDeliveryPayment } from './_peerDeliveryPayments.js'
import { fetchVerifiedPayment } from './_paymentVerification.js'
import { getFapshiBaseUrl, getFapshiConfig, getFapshiPaymentFlow, readJsonResponse } from './_fapshi.js'

const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

const cleanText = (value, max = 500) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, max)

function requireIdentifier(value, label) {
  const identifier = String(value || '')
  if (!/^PD-[A-F0-9]{20}$/.test(identifier)) throw deliveryError(`A valid ${label} is required.`, 400)
  return identifier
}

async function requireRole(db, user, role) {
  const profile = await db.collection('users').doc(user.uid).get()
  if (profile.data()?.accountType !== role) {
    throw deliveryError(role === 'admin' ? 'Administrator access is required.' : `An approved ${role} account is required.`, 403)
  }
  return profile.data()
}

async function enforceRateLimit(db, uid, key, limit, windowMs) {
  const ref = db.collection('peerDeliveryRateLimits').doc(`${key}-${uid}`)
  const now = Date.now()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const state = snapshot.data() || {}
    const startedAt = Number(state.startedAt || 0)
    const count = now - startedAt < windowMs ? Number(state.count || 0) : 0
    if (count >= limit) throw deliveryError('Too many requests. Wait before trying again.', 429)
    transaction.set(ref, { startedAt: count ? startedAt : now, count: count + 1, updatedAt: FieldValue.serverTimestamp() })
  })
}

async function verifiedPlace(placeId) {
  const id = cleanText(placeId, 200)
  const key = String(process.env.GOOGLE_MAPS_SERVER_API_KEY || '').trim()
  if (!key) throw deliveryError('Secure location verification is not configured.', 503)
  if (id.length < 5 || /\s/.test(id)) throw deliveryError('Choose a location from the address search results.', 400)

  let response
  try {
    response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents' },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw deliveryError('Location verification is temporarily unavailable. Try again.', 503)
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 400) throw deliveryError('That address could not be verified. Choose another search result.', 400)
    throw deliveryError('Location verification is temporarily unavailable. Try again.', 503)
  }
  const place = await response.json()
  const point = coordinates({ lat: place.location?.latitude, lng: place.location?.longitude })
  const isCameroon = place.addressComponents?.some((component) => component.types?.includes('country') && component.shortText === 'CM')
  if (place.id !== id || !point || !place.formattedAddress || !isCameroon) {
    throw deliveryError('Choose a verified address in Cameroon.', 400)
  }
  return { placeId: id, address: cleanText(place.formattedAddress, 240), ...point }
}

async function verifiedLocations(body) {
  const pickupId = body.pickup?.placeId
  const destinationId = body.destination?.placeId
  if (!pickupId || !destinationId) throw deliveryError('Choose pickup and destination from the address search results.', 400)
  const [pickupPlace, destinationPlace] = await Promise.all([verifiedPlace(pickupId), verifiedPlace(destinationId)])
  return {
    pickup: {
      ...pickupPlace,
      landmark: cleanText(body.pickup?.landmark, 120),
      instructions: cleanText(body.pickup?.instructions, 500),
    },
    destination: {
      ...destinationPlace,
      landmark: cleanText(body.destination?.landmark, 120),
      instructions: cleanText(body.destination?.instructions, 500),
    },
  }
}

function validatePackage(body) {
  const category = cleanText(body.category, 60)
  const description = cleanText(body.description, 500)
  const weightKg = body.weightKg === '' || body.weightKg == null ? 0 : Number(body.weightKg)
  const quantity = Number(body.quantity)
  const declaredValue = body.declaredValue === '' || body.declaredValue == null ? null : Number(body.declaredValue)
  const dimensions = ['lengthCm', 'widthCm', 'heightCm'].map((key) => {
    const value = body[key] === '' || body[key] == null ? null : Number(body[key])
    if (value !== null && (!Number.isSafeInteger(value) || value < 1 || value > 300)) {
      throw deliveryError('Package dimensions must be whole numbers from 1 to 300 cm.', 400)
    }
    return value
  })
  if (!peerDeliveryPackageCategories.includes(category)) throw deliveryError('Choose a valid package category.', 400)
  if (description.length < 3) throw deliveryError('Describe the package in at least 3 characters.', 400)
  if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100) throw deliveryError('Enter a valid package weight.', 400)
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw deliveryError('Package quantity must be from 1 to 10.', 400)
  if (declaredValue !== null && (!Number.isSafeInteger(declaredValue) || declaredValue < 0 || declaredValue > 100000000)) {
    throw deliveryError('Enter a valid declared value.', 400)
  }
  if (body.permitted !== true) throw deliveryError('Confirm the package contains no prohibited or dangerous goods.', 400)
  if (!['sender', 'recipient'].includes(body.payer)) throw deliveryError('Choose who will pay the delivery fee.', 400)
  return {
    category,
    description,
    weightKg,
    quantity,
    lengthCm: dimensions[0],
    widthCm: dimensions[1],
    heightCm: dimensions[2],
    declaredValue,
    payer: body.payer,
  }
}

function serverQuote(body, locations) {
  const weightKg = body.weightKg === '' || body.weightKg == null ? 0 : Number(body.weightKg)
  const quote = calculatePeerDeliveryQuote({ ...locations, weightKg })
  const { quotedAt, ...publicQuote } = quote
  return { stored: quote, public: publicQuote }
}

async function listMine(db, uid) {
  const collection = db.collection('peerDeliveries')
  const [sent, received] = await Promise.all([
    collection.where('senderId', '==', uid).limit(100).get(),
    collection.where('recipientId', '==', uid).limit(100).get(),
  ])
  const records = new Map()
  for (const document of [...sent.docs, ...received.docs]) {
    records.set(document.id, participantSummary(document.data(), document.id, uid))
  }
  return [...records.values()].sort((first, second) => {
    const firstDate = first.createdAt?.toMillis?.() || 0
    const secondDate = second.createdAt?.toMillis?.() || 0
    return secondDate - firstDate
  })
}

function participantSummary(delivery, id, uid) {
  const summary = safeDeliverySummary(delivery, id)
  summary.currentUserRole = delivery.senderId === uid ? 'sender' : 'recipient'
  summary.canPay = delivery.payment?.payerId === uid
  summary.hasRider = Boolean(delivery.riderId)
  delete summary.senderId
  delete summary.recipientId
  delete summary.riderId
  if (summary.payment) delete summary.payment.payerId
  return summary
}

async function createDelivery(db, user, body, locations, profile, res) {
  const senderPhone = assertPhoneClaim(user, body.senderPhone)
  const recipientPhone = normalizeCameroonPhone(body.recipientPhone)
  if (!recipientPhone || recipientPhone === senderPhone) throw deliveryError('Enter a different valid CareNest recipient phone number.', 400)

  const packageInfo = validatePackage(body)
  const { stored: pricing, public: publicPricing } = await serverQuote({ weightKg: packageInfo.weightKg }, locations)
  const deliveryId = makeDeliveryId()
  const invitationToken = makeInvitationToken()
  const deliveryRef = db.collection('peerDeliveries').doc(deliveryId)
  const delivery = {
    id: deliveryId,
    deliveryType: 'peer_to_peer',
    status: 'awaiting_recipient',
    senderId: user.uid,
    senderName: cleanText(profile.name || user.name || user.email || 'CareNest customer', 80),
    recipientId: null,
    recipientPhoneHash: hashPrivateValue(recipientPhone),
    pickup: locations.pickup,
    destination: {
      ...locations.destination,
      instructions: cleanText(body.destination?.instructions, 500),
    },
    package: packageInfo,
    pricing,
    payment: {
      payerMode: packageInfo.payer,
      payerId: packageInfo.payer === 'sender' ? user.uid : null,
      amount: publicPricing.deliveryFee,
      currency: 'XAF',
      status: 'not_started',
      initiationState: '',
      reference: '',
      receiptReference: '',
      retiredReferences: [],
    },
    recipientAcceptance: { status: 'pending' },
    invitationTokenHash: hashSecret(invitationToken),
    invitationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    riderId: null,
    riderName: null,
    tracking: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await db.runTransaction(async (transaction) => {
    transaction.create(deliveryRef, delivery)
    auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'customer' }, 'request_created', '', 'awaiting_recipient')
  })
  const publicDelivery = participantSummary(delivery, deliveryId, user.uid)
  publicDelivery.pricing = publicPricing
  return send(res, 201, {
    delivery: publicDelivery,
    invitationPath: `/dashboard/customer/package?invite=${encodeURIComponent(invitationToken)}`,
  })
}

async function acceptInvitation(db, user, token) {
  const profile = await requireRole(db, user, 'customer')
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw deliveryError('This invitation is invalid or expired.', 404)
  await enforceRateLimit(db, user.uid, 'accept', 10, 10 * 60 * 1000)
  const matches = await db.collection('peerDeliveries').where('invitationTokenHash', '==', hashSecret(token)).limit(2).get()
  if (matches.size !== 1) throw deliveryError('This invitation is invalid or expired.', 404)
  const ref = matches.docs[0].ref
  const accepted = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw deliveryError('This invitation is invalid or expired.', 404)
    const delivery = snapshot.data()
    const expiry = delivery.invitationExpiresAt?.toMillis?.() || 0
    if (delivery.status !== 'awaiting_recipient' || expiry <= Date.now()
      || delivery.invitationTokenHash !== hashSecret(token) || delivery.senderId === user.uid) {
      throw deliveryError('This invitation is invalid or expired.', 404)
    }
    const recipientPhone = normalizeCameroonPhone(user.phone_number)
    if (!recipientPhone || hashPrivateValue(recipientPhone) !== delivery.recipientPhoneHash) {
      throw deliveryError('Verify the phone number associated with this invitation on your CareNest account.', 403)
    }
    const payerId = delivery.payment?.payerMode === 'recipient' ? user.uid : delivery.senderId
    const nextStatus = assertTransition(delivery.status, 'awaiting_payment')
    transaction.update(ref, {
      status: nextStatus,
      recipientId: user.uid,
      recipientName: cleanText(profile.name || user.name || 'Recipient', 80),
      recipientAcceptance: { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() },
      invitationTokenHash: FieldValue.delete(),
      invitationExpiresAt: FieldValue.delete(),
      'payment.payerId': payerId,
      updatedAt: FieldValue.serverTimestamp(),
    })
    auditDelivery(transaction, db, delivery.id, { uid: user.uid, role: 'customer' }, 'recipient_accepted', delivery.status, nextStatus)
    return { ...delivery, status: nextStatus, recipientId: user.uid, recipientAcceptance: { status: 'accepted' }, payment: { ...delivery.payment, payerId } }
  })
  return participantSummary(accepted, accepted.id, user.uid)
}

async function createInvitation(db, user, deliveryId) {
  const ref = db.collection('peerDeliveries').doc(deliveryId)
  await enforceRateLimit(db, user.uid, 'invite', 10, 60 * 60 * 1000)
  const invitationToken = makeInvitationToken()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw deliveryError('Delivery not found.', 404)
    const delivery = snapshot.data()
    if (delivery.senderId !== user.uid) throw deliveryError('Only the sender can invite the recipient.', 403)
    if (delivery.status !== 'awaiting_recipient') throw deliveryError('This delivery is no longer waiting for recipient acceptance.', 409)
    transaction.update(ref, {
      invitationTokenHash: hashSecret(invitationToken),
      invitationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    })
    auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'customer' }, 'invitation_renewed', delivery.status, delivery.status)
  })
  return { invitationPath: `/dashboard/customer/package?invite=${encodeURIComponent(invitationToken)}` }
}

async function assignRider(db, user, body) {
  await requireRole(db, user, 'admin')
  const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
  const riderId = cleanText(body.riderId, 128)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(riderId)) throw deliveryError('Choose a valid rider.', 400)
  const deliveryRef = db.collection('peerDeliveries').doc(deliveryId)
  const riderRef = db.collection('users').doc(riderId)
  await db.runTransaction(async (transaction) => {
    const [deliverySnapshot, riderSnapshot] = await Promise.all([transaction.get(deliveryRef), transaction.get(riderRef)])
    if (!deliverySnapshot.exists) throw deliveryError('Delivery not found.', 404)
    if (riderSnapshot.data()?.accountType !== 'rider' || riderSnapshot.data()?.riderVerified !== true) {
      throw deliveryError('Choose an approved CareNest rider.', 400)
    }
    const delivery = deliverySnapshot.data()
    if (delivery.status !== 'searching_rider' || delivery.payment?.status !== 'paid') {
      throw deliveryError('Only paid deliveries waiting for a rider can be assigned.', 409)
    }
    const status = assertTransition(delivery.status, 'rider_assigned')
    transaction.update(deliveryRef, {
      riderId,
      riderName: cleanText(riderSnapshot.data().name || 'CareNest rider', 80),
      status,
      assignedBy: user.uid,
      assignedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'admin' }, 'rider_assigned', delivery.status, status, { riderId })
  })
  return { assigned: true, deliveryId }
}

async function updateRiderDelivery(db, user, body) {
  const profile = await requireRole(db, user, 'rider')
  const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
  const ref = db.collection('peerDeliveries').doc(deliveryId)
  const outcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw deliveryError('Delivery not found.', 404)
    const delivery = snapshot.data()
    if (delivery.riderId !== user.uid) throw deliveryError('This delivery is not assigned to your rider account.', 403)
    if (delivery.payment?.status !== 'paid') throw deliveryError('Payment must be verified before delivery can proceed.', 409)

    if (body.action === 'location') {
      if (isTerminalDeliveryStatus(delivery.status)) throw deliveryError('Location sharing has ended for this delivery.', 409)
      const point = coordinates(body.location)
      const accuracy = Number(body.location?.accuracy || 0)
      if (!point || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000) throw deliveryError('The device returned an invalid location.', 400)
      const lastUpdated = delivery.tracking?.lastUpdatedAt?.toMillis?.() || 0
      if (Date.now() - lastUpdated < 5000) throw deliveryError('Wait before sending another location update.', 429)
      transaction.update(ref, {
        tracking: { lastLatitude: point.lat, lastLongitude: point.lng, accuracy, lastUpdatedAt: FieldValue.serverTimestamp() },
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { updated: true, deliveryId }
    }
    if (body.action === 'stopTracking') {
      transaction.update(ref, { tracking: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
      auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'rider' }, 'tracking_stopped', delivery.status, delivery.status)
      return { updated: true, deliveryId }
    }

    const nextStatus = String(body.status || '')
    const status = assertTransition(delivery.status, nextStatus)
    if (!['rider_to_pickup', 'rider_arrived_pickup', 'package_picked_up', 'in_transit', 'near_destination', 'delivered', 'failed_delivery'].includes(status)) {
      throw deliveryError('This delivery status cannot be set by a rider.', 403)
    }
    transaction.update(ref, {
      status,
      ...(status === 'delivered' || status === 'failed_delivery' ? { tracking: FieldValue.delete(), completedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      riderStatusUpdatedBy: user.uid,
      riderStatusUpdatedAt: FieldValue.serverTimestamp(),
    })
    auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'rider' }, 'status_updated', delivery.status, status)
    return { updated: true, deliveryId, status }
  })
  return { ...outcome, riderName: cleanText(profile.name || 'CareNest rider', 80) }
}

async function startPayment(db, user, body) {
  const profile = await requireRole(db, user, 'customer')
  const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
  const phone = normalizePaymentPhone(body.paymentPhone)
  const network = detectPaymentNetwork(phone)
  if (!network) throw deliveryError(unsupportedPaymentPhoneMessage, 400)
  const { apiUrl, apiUser, apiKey } = getFapshiConfig()
  const direct = getFapshiPaymentFlow() === 'direct'
  const ref = db.collection('peerDeliveries').doc(deliveryId)
  const rateRef = db.collection('paymentRateLimits').doc(`peer-${user.uid}`)
  const now = Date.now()
  const initiationId = randomUUID()
  let attempt

  await db.runTransaction(async (transaction) => {
    const [snapshot, rateSnapshot] = await Promise.all([transaction.get(ref), transaction.get(rateRef)])
    if (!snapshot.exists) throw deliveryError('Delivery not found.', 404)
    const delivery = snapshot.data()
    const payment = delivery.payment || {}
    if (delivery.status !== 'awaiting_payment' || payment.payerId !== user.uid || payment.amount !== delivery.pricing?.deliveryFee) {
      throw deliveryError('This account is not responsible for paying this delivery.', 403)
    }
    const rate = rateSnapshot.data() || {}
    const recent = now - Number(rate.windowStartedAt || 0) < 60000
    if (recent && Number(rate.attempts || 0) >= 5) throw deliveryError('Too many payment attempts. Wait one minute and try again.', 429)
    if (payment.status === 'paid'
      || (['starting', 'unknown', 'submitted'].includes(String(payment.initiationState || '').toLowerCase()) && payment.status !== 'failed')) {
      throw deliveryError('A payment is already complete or awaiting verification.', 409)
    }
    if (payment.status === 'failed' && !['FAILED', 'EXPIRED'].includes(payment.verifiedProviderStatus)) {
      throw deliveryError('The previous payment outcome is unknown. Contact CareNest support before paying again.', 409)
    }
    const nextPayment = {
      ...payment,
      ...(payment.status === 'failed' && payment.reference ? { retiredReferences: [...(payment.retiredReferences || []), payment.reference] } : {}),
      status: 'starting',
      initiationState: 'starting',
      initiationId,
      initiationStartedAtMs: now,
      initiatedBy: user.uid,
      paymentPhone: phone,
      paymentNetwork: network,
      reference: '',
      receiptReference: '',
      verifiedProviderStatus: '',
      lastCheckedAtMs: 0,
    }
    transaction.update(ref, { payment: nextPayment, paymentEnvironment: apiUrl.includes('sandbox') ? 'sandbox' : 'live', updatedAt: FieldValue.serverTimestamp() })
    transaction.set(rateRef, {
      uid: user.uid,
      attempts: recent ? Number(rate.attempts || 0) + 1 : 1,
      windowStartedAt: recent ? rate.windowStartedAt : now,
      updatedAt: FieldValue.serverTimestamp(),
    })
    attempt = { delivery, payment: nextPayment }
  })

  const updatePayment = (changes) => db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return
    const current = snapshot.data()
    if (current.payment?.initiationId !== initiationId || current.payment.status === 'paid'
      || ['FAILED', 'EXPIRED'].includes(current.payment?.verifiedProviderStatus)) return
    transaction.update(ref, { payment: { ...current.payment, ...changes }, updatedAt: FieldValue.serverTimestamp() })
  })

  let response
  let result
  try {
    response = await fetch(direct ? getFapshiBaseUrl(apiUrl) + '/direct-pay' : apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apiuser: apiUser, apikey: apiKey },
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        amount: attempt.payment.amount,
        medium: network === 'mtn' ? 'mobile money' : 'orange money',
        email: user.email || '',
        userId: user.uid,
        externalId: deliveryId,
        message: 'CareNest package delivery ' + deliveryId,
        ...(direct ? { phone, name: cleanText(profile.name || user.name || 'CareNest customer', 100) } : {}),
      }),
    })
    result = await readJsonResponse(response)
  } catch {
    await updatePayment({ status: 'unknown', initiationState: 'Unknown' })
    throw deliveryError('The payment outcome is unknown. Check its status before trying again.', 503)
  }

  if (!response.ok) {
    const definitiveFailure = [400, 401, 403, 404, 422].includes(response.status)
    await updatePayment({
      status: definitiveFailure ? 'failed' : 'unknown',
      initiationState: definitiveFailure ? 'Failed' : 'Unknown',
      verifiedProviderStatus: definitiveFailure ? 'FAILED' : '',
    })
    throw deliveryError(definitiveFailure
      ? 'The payment provider did not accept the request. You may review the payment status before retrying.'
      : 'The payment outcome is unknown. Check its status before trying again.', definitiveFailure ? 502 : 503)
  }

  const reference = String(result.transId || result.transactionId || result.reference || '').trim()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reference) || (attempt.payment.retiredReferences || []).includes(reference)) {
    await updatePayment({ status: 'unknown', initiationState: 'Unknown' })
    throw deliveryError('The payment outcome is unknown. Check its status before trying again.', 502)
  }
  await updatePayment({
    status: 'submitted',
    provider: 'Fapshi',
    providerStatus: String(result.status || 'PENDING').toUpperCase(),
    reference,
    receiptReference: reference,
    initiationState: 'submitted',
  })
  return { accepted: true, message: 'Payment request sent. CareNest will verify it with Fapshi.' }
}

async function verifyPayment(db, user, deliveryId) {
  requireIdentifier(deliveryId, 'delivery identifier')
  const ref = db.collection('peerDeliveries').doc(deliveryId)
  const delivery = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw deliveryError('Delivery not found.', 404)
    const current = snapshot.data()
    if (![current.senderId, current.recipientId].includes(user.uid)) throw deliveryError('You cannot access this delivery.', 403)
    if (current.payment?.payerId !== user.uid) throw deliveryError('Only the designated payer can verify this payment.', 403)
    if (current.payment?.status === 'paid') return current
    if (Date.now() - Number(current.payment?.lastCheckedAtMs || 0) < 15000) throw deliveryError('Wait 15 seconds before checking the payment again.', 429)
    transaction.update(ref, { 'payment.lastCheckedAtMs': Date.now(), updatedAt: FieldValue.serverTimestamp() })
    return current
  })
  if (delivery.payment?.status === 'paid') return { paymentStatus: 'paid', status: delivery.status }

  let reference = delivery.payment?.reference || ''
  if (!reference && ['starting', 'unknown'].includes(String(delivery.payment?.initiationState || '').toLowerCase())) {
    const { apiUrl, apiUser, apiKey } = getFapshiConfig()
    const query = new URLSearchParams({ amt: String(delivery.payment.amount), limit: '100', sort: 'desc' })
    if (delivery.payment.initiationStartedAtMs) query.set('start', new Date(delivery.payment.initiationStartedAtMs).toISOString().slice(0, 10))
    const response = await fetch(getFapshiBaseUrl(apiUrl) + '/search?' + query, {
      headers: { apiuser: apiUser, apikey: apiKey },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
    const result = await readJsonResponse(response)
    if (!response.ok || !Array.isArray(result)) throw deliveryError('Unable to reconcile this payment. Contact CareNest support.', 503)
    const matches = result.filter((item) => item.externalId === deliveryId && item.userId === delivery.payment.payerId
      && Number(item.amount) === delivery.payment.amount && !(delivery.payment.retiredReferences || []).includes(item.transId || item.transactionId))
    if (matches.length !== 1) throw deliveryError('The previous payment outcome is still unknown. Contact CareNest support before trying again.', 409)
    reference = String(matches[0].transId || matches[0].transactionId || '')
  }
  if (!reference) return { paymentStatus: delivery.payment?.status || 'not_started', status: delivery.status }
  const payment = await fetchVerifiedPayment(reference)
  return applyVerifiedPeerDeliveryPayment(db, payment, 'fapshi-poll', deliveryId)
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })

  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    const body = req.body || {}

    if (body.action === 'list') {
      await requireRole(db, user, 'admin')
      const snapshot = await db.collection('peerDeliveries').orderBy('createdAt', 'desc').limit(200).get()
      return send(res, 200, { deliveries: snapshot.docs.map((document) => safeDeliverySummary(document.data(), document.id)) })
    }
    if (body.action === 'listMine') {
      await requireRole(db, user, 'customer')
      return send(res, 200, { deliveries: await listMine(db, user.uid) })
    }
    if (body.action === 'listRider') {
      await requireRole(db, user, 'rider')
      const snapshot = await db.collection('peerDeliveries').where('riderId', '==', user.uid).limit(100).get()
      return send(res, 200, { deliveries: snapshot.docs.map((document) => safeDeliverySummary(document.data(), document.id)) })
    }
    if (body.action === 'quote' || body.action === 'create') {
      const profile = await requireRole(db, user, 'customer')
      if (body.action === 'create') {
        assertPhoneClaim(user, body.senderPhone)
        await enforceRateLimit(db, user.uid, 'create', 5, 60 * 60 * 1000)
      } else {
        await enforceRateLimit(db, user.uid, 'quote', 30, 60 * 1000)
      }
      const locations = await verifiedLocations(body)
      if (body.action === 'quote') {
        const { public: quote } = await serverQuote(body, locations)
        return send(res, 200, { quote })
      }
      return await createDelivery(db, user, body, locations, profile, res)
    }
    if (body.action === 'accept') {
      const token = String(body.token || '')
      const delivery = await acceptInvitation(db, user, token)
      return send(res, 200, { delivery })
    }
    if (body.action === 'invite') {
      await requireRole(db, user, 'customer')
      const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
      return send(res, 200, await createInvitation(db, user, deliveryId))
    }
    if (body.action === 'cancel') {
      await requireRole(db, user, 'customer')
      const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
      const ref = db.collection('peerDeliveries').doc(deliveryId)
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        if (!snapshot.exists) throw deliveryError('Delivery not found.', 404)
        const delivery = snapshot.data()
        if (delivery.senderId !== user.uid) throw deliveryError('Only the sender can cancel this request.', 403)
        if (!['awaiting_recipient', 'awaiting_payment'].includes(delivery.status)
          || ['starting', 'unknown', 'submitted', 'paid'].includes(delivery.payment?.status)) {
          throw deliveryError('This request can no longer be cancelled online. Contact CareNest support.', 409)
        }
        const status = assertTransition(delivery.status, 'cancelled')
        transaction.update(ref, { status, updatedAt: FieldValue.serverTimestamp(), cancelledAt: FieldValue.serverTimestamp() })
        auditDelivery(transaction, db, deliveryId, { uid: user.uid, role: 'customer' }, 'request_cancelled', delivery.status, status)
      })
      return send(res, 200, { cancelled: true })
    }
    if (body.action === 'assignRider') return send(res, 200, await assignRider(db, user, body))
    if (body.action === 'riderStatus' || body.action === 'location' || body.action === 'stopTracking') {
      return send(res, 200, await updateRiderDelivery(db, user, body))
    }
    if (body.action === 'startPayment') {
      return send(res, 202, await startPayment(db, user, body))
    }
    if (body.action === 'verifyPayment') {
      await requireRole(db, user, 'customer')
      const deliveryId = requireIdentifier(body.deliveryId, 'delivery identifier')
      return send(res, 200, await verifyPayment(db, user, deliveryId))
    }
    return send(res, 400, { error: 'Choose a supported peer-delivery action.' })
  } catch (error) {
    if (!error.statusCode) console.error('peer_delivery_request_failed', error)
    return send(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'The peer-delivery service is temporarily unavailable.',
    })
  }
}
