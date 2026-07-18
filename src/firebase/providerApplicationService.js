import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebaseConfig'

const applicationsRef = collection(db, 'providerApplications')

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

function normalizeApplication(docSnapshot) {
  const data = docSnapshot.data()
  return {
    firestoreId: docSnapshot.id,
    ...data,
    createdAtDate: toDate(data.createdAt),
    updatedAtDate: toDate(data.updatedAt),
    reviewedAtDate: toDate(data.reviewedAt),
  }
}

export function createProviderApplication(user, profile, application) {
  if (!user?.uid) throw new Error('Please login before applying.')
  const payload = {
    userUid: user.uid,
    name: profile?.name || user.displayName || application.name,
    email: user.email,
    phone: application.phone || profile?.phone || '',
    services: application.services.trim(),
    area: application.area.trim(),
    experience: application.experience.trim(),
    status: 'Pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  return setDoc(doc(db, 'providerApplications', user.uid), payload, { merge: true })
}

export function subscribeToMyProviderApplications(userUid, onNext, onError) {
  if (!userUid) return () => {}
  return onSnapshot(
    doc(db, 'providerApplications', userUid),
    (snapshot) => onNext(snapshot.exists() ? [normalizeApplication(snapshot)] : []),
    onError,
  )
}

export function subscribeToProviderApplications(onNext, onError) {
  return onSnapshot(
    query(applicationsRef, orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map(normalizeApplication)),
    onError,
  )
}

export function rejectProviderApplication(application, reviewerUid) {
  return updateDoc(doc(db, 'providerApplications', application.firestoreId), {
    status: 'Rejected',
    reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function approveProviderApplication(application, reviewerUid) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'providerApplications', application.firestoreId), {
    status: 'Approved',
    reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'users', application.userUid), {
    accountType: 'provider',
    availability: {
      status: 'Available',
      area: application.area,
      services: application.services,
      phone: application.phone,
    },
    payout: {
      method: 'MTN Mobile Money',
      phone: application.phone,
    },
    updatedAt: serverTimestamp(),
  })
  return batch.commit()
}
