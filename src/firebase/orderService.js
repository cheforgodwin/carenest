import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { servicePrices } from '../config/businessConfig'
import { auth, db } from './firebaseConfig'
import { assertTextLength, inputLimits, sanitizeTrimmedText } from '../utils/securityUtils'

const ordersRef = collection(db, 'serviceRequests')
const usersRef = collection(db, 'users')
const paymentSmsReceiptsRef = collection(db, 'paymentSmsReceipts')

export const statusSteps = {
  Pending: 0,
  Assigned: 1,
  'In Progress': 2,
  'Quality Check': 3,
  'Out for Delivery': 4,
  'Awaiting confirmation': 4,
  Completed: 5,
  Complaint: 2,
  Cancelled: 0,
}

export const paymentStatuses = ['Pending', 'Submitted', 'Paid', 'Failed', 'Refunded']
export const payoutStatuses = ['Unpaid', 'Ready', 'Paid', 'Partial', 'Held']
export const riderStatuses = ['Accepted', 'Picked up', 'Delivered']
export const providerPayoutRate = 0.8
export const payoutScheduleLabel = 'Weekly Sunday'

export function calculateProviderEarning(amount) {
  return Math.round(Number(amount || 0) * providerPayoutRate)
}

export function calculatePlatformFee(amount) {
  return Number(amount || 0) - calculateProviderEarning(amount)
}

export function isPayoutReady(order) {
  return order?.status === 'Completed' && order?.paymentStatus === 'Paid'
    && Boolean(order.customerUid) && order.completionConfirmedBy === order.customerUid
    && Boolean(order.completionConfirmedAt) && order.payoutStatus !== 'Held'
}

export function getPayoutStatus(order) {
  if (order?.payoutStatus === 'Ready' && !isPayoutReady(order)) return 'Unpaid'
  if (order?.payoutStatus) return order.payoutStatus
  if (['Complaint', 'Cancelled'].includes(order?.status) || ['Failed', 'Refunded'].includes(order?.paymentStatus)) {
    return 'Held'
  }
  return isPayoutReady(order) ? 'Ready' : 'Unpaid'
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

function normalizeOrder(docSnapshot) {
  const data = docSnapshot.data()
  const providerEarning = data.providerEarning ?? calculateProviderEarning(data.amount)
  return {
    firestoreId: docSnapshot.id,
    ...data,
    platformFee: data.platformFee ?? calculatePlatformFee(data.amount),
    providerEarning,
    providerPayoutAmount: data.providerPayoutAmount ?? providerEarning,
    payoutStatus: getPayoutStatus(data),
    payoutSchedule: data.payoutSchedule || payoutScheduleLabel,
    createdAtDate: toDate(data.createdAt),
    updatedAtDate: toDate(data.updatedAt),
    payoutPaidAtDate: toDate(data.payoutPaidAt),
  }
}

function normalizeUser(docSnapshot) {
  const data = docSnapshot.data()
  return {
    firestoreId: docSnapshot.id,
    ...data,
    createdAtDate: toDate(data.createdAt),
    updatedAtDate: toDate(data.updatedAt),
  }
}

function normalizePaymentSmsReceipt(docSnapshot) {
  const data = docSnapshot.data()
  return {
    firestoreId: docSnapshot.id,
    ...data,
    createdAtDate: toDate(data.createdAt),
    receivedAtDate: toDate(data.receivedAt),
  }
}

export function createRequestId() {
  const randomPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12)
    || Math.random().toString(36).slice(2, 14)
  return `CN-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`
}

function getExpectedAmount(order) {
  const pricing = servicePrices[order.serviceType]
  if (!pricing) return null
  const primaryValue = order.itemSummary || order.clothesType || order.propertyType || order.itemType
  const basePrice = pricing.primaryOptions[primaryValue]
  const speedPrice = pricing.serviceOptions[order.serviceSpeed]
  if (typeof basePrice !== 'number' || typeof speedPrice !== 'number') return null
  return basePrice + speedPrice
}

function sanitizeOrderInput(order) {
  const orderDetails = Object.fromEntries(Object.entries(order.orderDetails || {}).map(([key, value]) => [
    sanitizeTrimmedText(key, 60),
    sanitizeTrimmedText(value, inputLimits.address),
  ]))
  return {
    ...order,
    customerName: sanitizeTrimmedText(order.customerName, inputLimits.name),
    customerPhone: sanitizeTrimmedText(order.customerPhone, inputLimits.phone),
    service: sanitizeTrimmedText(order.service, inputLimits.title),
    itemSummary: sanitizeTrimmedText(order.itemSummary, inputLimits.title),
    address: sanitizeTrimmedText(order.address, inputLimits.address),
    note: sanitizeTrimmedText(order.note, inputLimits.note),
    orderDetails,
  }
}

function validateServiceRequest(order) {
  const expectedAmount = getExpectedAmount(order)
  if (expectedAmount === null || expectedAmount !== Number(order.amount)) {
    throw new Error('The request amount does not match the selected service.')
  }
  if (order.status !== 'Pending' || order.currentStep !== 0) {
    throw new Error('New requests must start as pending.')
  }
}

export async function createServiceRequest(order) {
  const safeOrder = sanitizeOrderInput(order)
  validateServiceRequest(safeOrder)
  const payload = {
    ...safeOrder,
    id: order.id || createRequestId(),
    status: order.status || 'Pending',
    currentStep: order.currentStep ?? 0,
    paymentMethod: order.paymentMethod || 'Cash',
    paymentStatus: order.paymentStatus || 'Pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const sanitizedPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value
    return acc
  }, {})

  const docRef = await addDoc(ordersRef, sanitizedPayload)
  return { firestoreId: docRef.id, ...sanitizedPayload, createdAtDate: new Date(), updatedAtDate: new Date() }
}

export async function createMarketplaceServiceRequest(order, listing) {
  const safeOrder = sanitizeOrderInput(order)
  const quantity = Number(safeOrder.quantity)
  if (!listing?.firestoreId || !listing.active) throw new Error('This listing is no longer available.')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new Error('Choose a valid quantity.')
  if (Number(safeOrder.amount) !== Number(listing.price) * quantity) throw new Error('The order total does not match the listing price.')
  if (listing.stockTracked && quantity > Number(listing.stockQuantity || 0)) throw new Error('The requested quantity is not in stock.')
  if (order.status !== 'Pending' || order.currentStep !== 0) throw new Error('New requests must start as pending.')

  const payload = Object.fromEntries(Object.entries({
    ...safeOrder,
    listingId: listing.firestoreId,
    listingTitle: listing.title,
    listingCategory: listing.category,
    providerUid: listing.providerUid,
    providerName: listing.providerName,
    providerPhone: listing.providerPhone || '',
    unitPrice: Number(listing.price),
    id: order.id || createRequestId(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).filter(([, value]) => value !== undefined))

  const docRef = await addDoc(ordersRef, payload)
  return { firestoreId: docRef.id, ...payload, createdAtDate: new Date(), updatedAtDate: new Date() }
}
export function subscribeToAllOrders(onNext, onError) {
  return onSnapshot(
    query(ordersRef, orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map(normalizeOrder)),
    onError,
  )
}

export function subscribeToCustomerOrders(customerUid, onNext, onError) {
  if (!customerUid) return () => {}
  return onSnapshot(
    query(ordersRef, where('customerUid', '==', customerUid)),
    (snapshot) => {
      const orders = snapshot.docs
        .map(normalizeOrder)
        .sort((a, b) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0))
      onNext(orders)
    },
    onError,
  )
}

export function subscribeToOpenProviderOrders(onNext) {
  onNext([])
  return () => {}
}

export function subscribeToProviderOrders(providerUid, onNext, onError) {
  if (!providerUid) return () => {}
  return onSnapshot(
    query(ordersRef, where('providerUid', '==', providerUid)),
    (snapshot) => onNext(snapshot.docs.map(normalizeOrder)),
    onError,
  )
}

export function subscribeToOpenRiderDeliveries(onNext) {
  onNext([])
  return () => {}
}

export function subscribeToRiderOrders(riderUid, onNext, onError) {
  if (!riderUid) return () => {}
  return onSnapshot(
    query(ordersRef, where('riderUid', '==', riderUid)),
    (snapshot) => onNext(snapshot.docs.map(normalizeOrder)),
    onError,
  )
}

export async function assignServiceRequestToRider(firestoreId, rider) {
  const orderRef = doc(db, 'serviceRequests', firestoreId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef)
    if (!snapshot.exists()) throw new Error('Service request was not found.')
    const order = snapshot.data()
    if (order.paymentStatus !== 'Paid' || !order.paymentVerifiedAt) throw new Error('Payment must be verified before rider assignment.')
    if (order.riderUid || order.status !== 'Out for Delivery') {
      throw new Error('This delivery is not available for rider assignment.')
    }
    transaction.update(orderRef, {
      riderUid: rider.uid,
      riderName: rider.name,
      riderPhone: rider.phone || '',
      riderStatus: 'Accepted',
      riderAssignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export function updateRiderDeliveryStatus(firestoreId, riderStatus) {
  const payload = {
    riderStatus,
    updatedAt: serverTimestamp(),
  }
  if (riderStatus === 'Delivered') {
    payload.status = 'Awaiting confirmation'
    payload.currentStep = statusSteps['Awaiting confirmation']
    payload.completionRequestedBy = auth.currentUser?.uid || ''
    payload.completionRequestedAt = serverTimestamp()
    payload.deliveredAt = serverTimestamp()
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), payload)
}

export function subscribeToUsers(onNext, onError) {
  return onSnapshot(
    query(usersRef, orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map(normalizeUser)),
    onError,
  )
}

export function subscribeToPaymentSmsReceipts(onNext, onError) {
  return onSnapshot(
    query(paymentSmsReceiptsRef, orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map(normalizePaymentSmsReceipt)),
    onError,
  )
}

export function updateServiceRequestStatus(firestoreId, status) {
  const payload = {
    status,
    currentStep: statusSteps[status] ?? 0,
    updatedAt: serverTimestamp(),
  }

  if (status === 'Complaint') payload.disputeStatus = 'Open'
  if (status === 'Complaint' || status === 'Cancelled') {
    payload.payoutStatus = 'Held'
    payload.payoutNote = status === 'Complaint'
      ? 'Provider payout held while customer complaint is reviewed.'
      : 'Provider payout held because the request was cancelled.'
  }

  return updateDoc(doc(db, 'serviceRequests', firestoreId), payload)
}

export function confirmCustomerCompletion(firestoreId) {
  if (!auth.currentUser) throw new Error('Please sign in again.')
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    status: 'Completed',
    currentStep: statusSteps.Completed,
    completionConfirmedBy: auth.currentUser.uid,
    completionConfirmedAt: serverTimestamp(),
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function submitCustomerComplaint(firestoreId, complaintText) {
  const cleanText = assertTextLength(complaintText, { field: 'Complaint', min: 10, max: inputLimits.description })
  if (cleanText.length < 10) {
    throw new Error('Please describe the problem before submitting a complaint.')
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    status: 'Complaint',
    currentStep: statusSteps.Complaint,
    disputeStatus: 'Open',
    complaintText: cleanText,
    complaintSubmittedAt: serverTimestamp(),
    payoutStatus: 'Held',
    payoutNote: 'Provider payout held while customer complaint is reviewed.',
    updatedAt: serverTimestamp(),
  })
}

export function updateProviderJobStatus(firestoreId, status, proofText = '') {
  const payload = {
    status,
    currentStep: statusSteps[status] ?? 0,
    updatedAt: serverTimestamp(),
  }

  if (['Assigned', 'In Progress'].includes(status)) {
    payload.providerAcceptedBy = auth.currentUser?.uid || ''
    payload.providerAcceptedAt = serverTimestamp()
  }
  if (status === 'Completed') {
    const cleanProof = assertTextLength(proofText, { field: 'Completion note', min: 8, max: inputLimits.note })
    if (cleanProof.length < 8) {
      throw new Error('Add a short completion note before marking this job completed.')
    }
    payload.completionProofText = cleanProof
    payload.status = 'Awaiting confirmation'
    payload.currentStep = statusSteps['Awaiting confirmation']
    payload.completionRequestedBy = auth.currentUser?.uid || ''
    payload.completionRequestedAt = serverTimestamp()
  }

  return updateDoc(doc(db, 'serviceRequests', firestoreId), payload)
}

export async function assignServiceRequestToProvider(firestoreId, provider) {
  const orderRef = doc(db, 'serviceRequests', firestoreId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef)
    if (!snapshot.exists()) throw new Error('Service request was not found.')
    const order = snapshot.data()
    if (order.providerUid || order.status !== 'Pending') {
      throw new Error('This job is no longer available.')
    }
    transaction.update(orderRef, {
      providerUid: provider.uid,
      providerName: provider.name,
      providerEmail: provider.email,
      providerPhone: provider.phone || '',
      providerPayoutMethod: provider.payout?.method || provider.payoutMethod || 'MTN Mobile Money',
      providerPayoutPhone: provider.payout?.phone || provider.payoutPhone || provider.phone || '',
      status: 'Assigned',
      currentStep: 1,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function adminAssignServiceRequest(firestoreId, provider, adminUid) {
  if (!provider?.uid) {
    throw new Error('Choose a provider before assigning the request.')
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    providerUid: provider.uid,
    providerName: provider.name || 'Provider',
    providerEmail: provider.email || '',
    providerPhone: provider.phone || '',
    providerPayoutMethod: provider.payout?.method || provider.payoutMethod || 'MTN Mobile Money',
    providerPayoutPhone: provider.payout?.phone || provider.payoutPhone || provider.phone || '',
    status: 'Assigned',
    currentStep: statusSteps.Assigned,
    assignedBy: adminUid || '',
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function adminClearServiceRequestProvider(firestoreId, adminUid) {
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    providerUid: deleteField(),
    providerName: deleteField(),
    providerEmail: deleteField(),
    providerPhone: deleteField(),
    providerPayoutMethod: deleteField(),
    providerPayoutPhone: deleteField(),
    status: 'Pending',
    currentStep: statusSteps.Pending,
    assignedBy: adminUid || '',
    assignedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export function requestOrderRefund(firestoreId, reviewerUid, note) {
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    refundStatus: 'Requested', refundRequestedBy: reviewerUid,
    refundRequestedAt: serverTimestamp(), refundNote: note,
    payoutStatus: 'Held', payoutNote: 'Refund requested; review required before settlement.',
    updatedAt: serverTimestamp(),
  })
}

export function updateProviderPayoutStatus(firestoreId, payoutStatus, reviewerUid = '', payoutNote = '', payoutAmount = null) {
  if (!payoutStatuses.includes(payoutStatus)) {
    throw new Error('Unsupported provider payout status.')
  }
  const payload = {
    payoutStatus,
    payoutSchedule: payoutScheduleLabel,
    payoutReviewedBy: reviewerUid,
    payoutReviewedAt: serverTimestamp(),
    payoutNote,
    payoutHistory: arrayUnion({
      status: payoutStatus,
      reviewerUid,
      note: payoutNote,
      recordedAt: new Date().toISOString(),
    }),
    payoutPaidAt: payoutStatus === 'Paid' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  }

  if (payoutStatus === 'Partial') {
    payload.providerPayoutAmount = Number(payoutAmount || 0)
  }

  return updateDoc(doc(db, 'serviceRequests', firestoreId), payload)
}

export function updateProviderAvailability(uid, availability) {
  return updateDoc(doc(db, 'users', uid), {
    availability,
    payout: {
      method: availability.payoutMethod || 'MTN Mobile Money',
      phone: availability.payoutPhone || availability.phone || '',
    },
    updatedAt: serverTimestamp(),
  })
}
