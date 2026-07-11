import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebaseConfig'

const ordersRef = collection(db, 'serviceRequests')
const usersRef = collection(db, 'users')

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

export const paymentStatuses = ['Pending', 'Paid', 'Failed', 'Refunded']

const servicePrices = {
  laundry: {
    serviceOptions: { Normal: 0, Express: 1500 },
    primaryOptions: {
      'Mixed clothes': 3000,
      'Shirts and trousers': 2500,
      'Beddings and towels': 4500,
      'Large family load': 6500,
    },
  },
  cleaning: {
    serviceOptions: { Standard: 0, 'Deep Clean': 4000 },
    primaryOptions: {
      Studio: 5000,
      '1 Bedroom': 7000,
      '2 Bedrooms': 10000,
      '3+ Bedrooms': 14000,
    },
  },
  delivery: {
    serviceOptions: { Standard: 0, Priority: 1000 },
    primaryOptions: {
      Groceries: 2500,
      'Household essentials': 3000,
      Pharmacy: 3500,
      'Custom errand': 4500,
    },
  },
}

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

export function updatePaymentStatus(firestoreId, paymentStatus) {
  if (!paymentStatuses.includes(paymentStatus)) {
    throw new Error('Unsupported payment status.')
  }
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    paymentStatus,
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
