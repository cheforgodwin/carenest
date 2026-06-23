import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebaseConfig'

export function formatPhoneNumber(phone) {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '')
  const digits = trimmed.replace(/\D/g, '')
  return digits.startsWith('237') ? `+${digits}` : `+237${digits}`
}

export function getPhoneUserId(phone) {
  return formatPhoneNumber(phone).replace(/\D/g, '')
}

export async function createUserProfile(profile) {
  const phone = formatPhoneNumber(profile.phone)
  const uid = getPhoneUserId(phone)
  const ref = doc(db, 'users', uid)
  const existing = await getDoc(ref)
  const payload = {
    uid,
    phone,
    name: profile.name.trim(),
    accountType: profile.accountType,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, payload, { merge: true })
  return { ...payload, createdAt: null, updatedAt: null }
}

export async function getUserProfileByPhone(phone) {
  const snapshot = await getDoc(doc(db, 'users', getPhoneUserId(phone)))
  return snapshot.exists() ? snapshot.data() : null
}

export function getDashboardPath(accountType) {
  return {
    admin: '/dashboard/admin',
    customer: '/dashboard/customer',
    provider: '/dashboard/provider',
  }[accountType] || '/dashboard/customer'
}

export function saveAuthSession(profile) {
  localStorage.setItem('carenest_auth_user', JSON.stringify({
    uid: profile.uid,
    phone: profile.phone,
    name: profile.name || '',
    accountType: profile.accountType || 'customer',
  }))
}
