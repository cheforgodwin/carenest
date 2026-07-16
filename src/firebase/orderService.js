import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { servicePrices } from '../config/businessConfig'
import { db } from './firebaseConfig'

const ordersRef = collection(db, 'serviceRequests')
const usersRef = collection(db, 'users')
const paymentSmsReceiptsRef = collection(db, 'paymentSmsReceipts')

export const statusSteps = {
  Pending: 0,
  Assigned: 1,
  'In Progress': 2,
  'Quality Check': 3,
  'Out for Delivery': 4,
  Completed: 5,
  Complaint: 2,
  Cancelled: 0,
}

export const paymentStatuses = ['Pending', 'Submitted', 'Paid', 'Failed', 'Refunded']

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

function normalizeOrder(docSnapshot) {
  const data = docSnapshot.data()
  return {
    firestoreId: docSnapshot.id,
    ...data,
    createdAtDate: toDate(data.createdAt),
    updatedAtDate: toDate(data.updatedAt),
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
  return `CN-${String(Date.now()).slice(-6)}`
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
  validateServiceRequest(order)
  const payload = {
    ...order,
    id: order.id || createRequestId(),
    status: order.status || 'Pending',
    currentStep: order.currentStep ?? 0,
    paymentMethod: order.paymentMethod || 'Cash',
    paymentStatus: order.paymentStatus || 'Pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
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

export function subscribeToOpenProviderOrders(onNext, onError) {
  return onSnapshot(
    query(ordersRef, where('status', '==', 'Pending')),
    (snapshot) => onNext(snapshot.docs.map(normalizeOrder)),
    onError,
  )
}

export function subscribeToProviderOrders(providerUid, onNext, onError) {
  if (!providerUid) return () => {}
  return onSnapshot(
    query(ordersRef, where('providerUid', '==', providerUid)),
    (snapshot) => onNext(snapshot.docs.map(normalizeOrder)),
    onError,
  )
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
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    status,
    currentStep: statusSteps[status] ?? 0,
    updatedAt: serverTimestamp(),
  })
}

export async function assignServiceRequestToProvider(firestoreId, provider) {
  const snapshot = await getDoc(doc(db, 'serviceRequests', firestoreId))
  if (!snapshot.exists()) throw new Error('Service request was not found.')
  const order = snapshot.data()
  if (order.providerUid || order.status !== 'Pending') {
    throw new Error('This job is no longer available.')
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    providerUid: provider.uid,
    providerName: provider.name,
    providerEmail: provider.email,
    status: 'Assigned',
    currentStep: 1,
    updatedAt: serverTimestamp(),
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
    status: 'Pending',
    currentStep: statusSteps.Pending,
    assignedBy: adminUid || '',
    assignedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export function updatePaymentStatus(firestoreId, paymentStatus, reviewerUid = '', reviewNote = '') {
  if (!paymentStatuses.includes(paymentStatus)) {
    throw new Error('Unsupported payment status.')
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    paymentStatus,
    paymentReviewedBy: reviewerUid,
    paymentReviewedAt: serverTimestamp(),
    paymentReviewNote: reviewNote,
    paidAt: paymentStatus === 'Paid' ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  })
}

export function updateProviderAvailability(uid, availability) {
  return updateDoc(doc(db, 'users', uid), {
    availability,
    updatedAt: serverTimestamp(),
  })
}
