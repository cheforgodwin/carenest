import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebaseConfig'

export function formatPhoneNumber(phone) {
  const trimmed = phone.trim()

  if (trimmed.startsWith('+')) {
    return trimmed.replace(/\s+/g, '')
  }

  const digits = trimmed.replace(/\D/g, '')
  return digits.startsWith('237') ? `+${digits}` : `+237${digits}`
}

export function getPhoneUserId(phone) {
  return formatPhoneNumber(phone).replace(/\D/g, '')
}

export async function createUserProfile(profile) {
  const formattedPhone = formatPhoneNumber(profile.phone)
  const uid = getPhoneUserId(formattedPhone)
  const userRef = doc(db, 'users', uid)
  const existingProfile = await getDoc(userRef)
  const userProfile = {
    uid,
    name: profile.name.trim(),
    phone: formattedPhone,
    accountType: profile.accountType,
    updatedAt: serverTimestamp(),
    createdAt: existingProfile.exists()
      ? existingProfile.data().createdAt
      : serverTimestamp(),
  }

  await setDoc(userRef, userProfile, { merge: true })

  return {
    ...userProfile,
    createdAt: existingProfile.exists() ? existingProfile.data().createdAt : null,
    updatedAt: null,
  }
}

export async function getUserProfileByPhone(phone) {
  const uid = getPhoneUserId(phone)
  const snapshot = await getDoc(doc(db, 'users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export function getDashboardPath(accountType) {
  const dashboards = {
    admin: '/dashboard/admin',
    customer: '/dashboard/customer',
    provider: '/dashboard/provider',
  }

  return dashboards[accountType] || dashboards.customer
}

export function saveAuthSession(profile = {}) {
  localStorage.setItem(
    'carenest_auth_user',
    JSON.stringify({
      uid: profile.uid,
      phone: profile.phone,
      name: profile.name || '',
      accountType: profile.accountType || 'customer',
    }),
  )
}
