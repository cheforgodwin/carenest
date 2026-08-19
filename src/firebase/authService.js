import {
  createUserWithEmailAndPassword,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { phoneCountryCode } from '../config/businessConfig'
import { auth, db } from './firebaseConfig'
import { isValidCameroonPhone as isValidCameroonPhoneUtil, normalizePhoneNumber } from './phoneUtils'

const allowedRoles = ['admin', 'customer', 'provider', 'rider']

export function formatPhoneNumber(phone) {
  return normalizePhoneNumber(phone, phoneCountryCode || '237')
}

export function isValidCameroonPhone(phone) {
  return isValidCameroonPhoneUtil(phone, phoneCountryCode || '237')
}

export function validateSignupProfile(profile) {
  if (profile.name.trim().length < 2) throw new Error('Enter your full name.')
  if (!isValidCameroonPhone(profile.phone)) throw new Error('Enter a valid Cameroon number, for example +237 6XX XXX XXX.')
  if (profile.password.length < 8 || !/[A-Za-z]/.test(profile.password) || !/\d/.test(profile.password)) {
    throw new Error('Use at least 8 characters with both letters and numbers.')
  }
}

export function normalizeRole(role) {
  return allowedRoles.includes(role) ? role : 'customer'
}

export function createUserIdentifier(profile) {
  const email = profile.email.trim().toLowerCase()
  const name = profile.name.trim().toLowerCase().replace(/\s+/g, '-')
  const phone = formatPhoneNumber(profile.phone).replace(/\D/g, '')
  return `${email}_${name}_${phone}`
}

export function getAuthErrorMessage(error) {
  return {
    'auth/api-key-not-valid': 'The Firebase API key is not valid. Check your environment variables.',
    'auth/configuration-not-found': 'Firebase Authentication is not configured for this project.',
    'auth/email-already-in-use': 'An account already exists for this email. Please login instead.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password login is not enabled in Firebase.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/user-not-found': 'No account exists for this email. Please sign up first.',
    'auth/user-token-expired': 'Your session expired. Please sign in again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/weak-password': 'Use at least 8 characters with both letters and numbers.',
    'auth/wrong-password': 'The password is incorrect.',
  }[error?.code] || error?.message || 'Something went wrong. Please try again.'
}

export async function createUserProfile(user, profile) {
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  const payload = {
    uid: user.uid,
    email: user.email,
    phone: formatPhoneNumber(profile.phone),
    name: profile.name.trim(),
    userIdentifier: createUserIdentifier({ ...profile, email: user.email }),
    accountType: 'customer',
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, payload, { merge: true })
  return { ...payload, createdAt: null, updatedAt: null }
}

export async function getUserProfile(uid) {
  if (!uid) return null
  const snapshot = await getDoc(doc(db, 'users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function signUpWithProfile(profile) {
  validateSignupProfile(profile)
  await setPersistence(auth, browserSessionPersistence)
  const credential = await createUserWithEmailAndPassword(
    auth,
    profile.email.trim(),
    profile.password,
  )
  await updateProfile(credential.user, { displayName: profile.name.trim() })
  const createdProfile = await createUserProfile(credential.user, profile)
  await sendEmailVerification(credential.user).catch(() => {})
  return createdProfile
}

export async function loginWithEmail(email, password) {
  await setPersistence(auth, browserSessionPersistence)
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return getUserProfile(credential.user.uid)
}

export function logout() {
  return signOut(auth)
}

export function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim())
}

export function requestEmailVerification(user) {
  if (!user) throw new Error('Please login again before requesting verification.')
  return sendEmailVerification(user)
}

export function getDashboardPath(accountType) {
  return {
    admin: '/dashboard/admin',
    customer: '/dashboard/customer',
    provider: '/dashboard/provider',
    rider: '/dashboard/rider',
  }[accountType] || '/dashboard/customer'
}
