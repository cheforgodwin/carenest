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
import { formatPhoneNumber, isValidCameroonPhone } from './authService'

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
    role: data.role || 'provider',
    createdAtDate: toDate(data.createdAt),
    updatedAtDate: toDate(data.updatedAt),
    reviewedAtDate: toDate(data.reviewedAt),
  }
}

export function createProviderApplication(user, profile, application) {
  if (!user?.uid) throw new Error('Please login before applying.')
  const phone = formatPhoneNumber(application.phone || profile?.phone || '')
  if (!isValidCameroonPhone(phone)) throw new Error('Enter a valid Cameroon phone number before applying.')
  const payload = {
    userUid: user.uid,
    name: profile?.name || user.displayName || application.name,
    email: user.email,
    phone,
    role: application.role || 'provider',
    services: application.services?.trim() || '',
    area: application.area?.trim() || '',
    experience: application.experience?.trim() || '',
    transportType: application.transportType?.trim() || '',
    dispatchRegion: application.dispatchRegion?.trim() || '',
    shiftAvailability: application.shiftAvailability?.trim() || '',
    status: 'Pending',
    identityVerified: false,
    payoutPhoneVerified: false,
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

export function updateProviderVerification(application, field, value, reviewerUid) {
  if (!['identityVerified', 'payoutPhoneVerified'].includes(field)) {
    throw new Error('Unsupported provider verification check.')
  }
  return updateDoc(doc(db, 'providerApplications', application.firestoreId), {
    [field]: Boolean(value),
    verificationReviewedBy: reviewerUid,
    verificationReviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function approveProviderApplication(application, reviewerUid) {
  if (!application.identityVerified || !application.payoutPhoneVerified) {
    throw new Error('Confirm the applicant identity and payout phone before approval.')
  }
  const role = application.role || 'provider'
  const batch = writeBatch(db)
  batch.update(doc(db, 'providerApplications', application.firestoreId), {
    status: 'Approved',
    role,
    reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const userUpdate = {
    accountType: role,
    updatedAt: serverTimestamp(),
  }

  if (role === 'provider') {
    userUpdate.availability = {
      status: 'Available',
      area: application.area,
      services: application.services,
      phone: application.phone,
    }
    userUpdate.payout = {
      method: 'MTN Mobile Money',
      phone: application.phone,
    }
    userUpdate.providerVerified = true
    userUpdate.payoutPhoneVerified = true
    userUpdate.providerVerifiedAt = serverTimestamp()
  } else if (role === 'rider') {
    userUpdate.riderVerified = true
    userUpdate.riderProfile = {
      status: 'Available',
      area: application.area,
      transportType: application.transportType,
      phone: application.phone,
      experience: application.experience,
    }
  }

  batch.update(doc(db, 'users', application.userUid), userUpdate)
  return batch.commit()
}
