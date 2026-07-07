import {
  addDoc,
  collection,
  doc,
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

export async function createServiceRequest(order) {
  const payload = {
    ...order,
    id: order.id || createRequestId(),
    status: order.status || 'Pending',
    currentStep: order.currentStep ?? 0,
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

export function subscribeToUsers(onNext, onError) {
  return onSnapshot(
    query(usersRef, orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map(normalizeUser)),
    onError,
  )
}

export function updateServiceRequestStatus(firestoreId, status) {
  const stepByStatus = {
    Pending: 0,
    Assigned: 1,
    'In Progress': 2,
    'Quality Check': 3,
    'Out for Delivery': 4,
    Completed: 5,
    Complaint: 2,
    Cancelled: 0,
  }

  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    status,
    currentStep: stepByStatus[status] ?? 0,
    updatedAt: serverTimestamp(),
  })
}

export function assignServiceRequestToProvider(firestoreId, provider) {
  return updateDoc(doc(db, 'serviceRequests', firestoreId), {
    providerUid: provider.uid,
    providerName: provider.name,
    providerEmail: provider.email,
    status: 'Assigned',
    currentStep: 1,
    updatedAt: serverTimestamp(),
  })
}

export function updateProviderAvailability(uid, availability) {
  return updateDoc(doc(db, 'users', uid), {
    availability,
    updatedAt: serverTimestamp(),
  })
}
