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
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { phoneCountryCode } from '../config/businessConfig'
import { auth, db } from './firebaseConfig'

const allowedRoles = ['admin', 'customer', 'provider']

export function formatPhoneNumber(phone) {
  const trimmed = phone.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (!phoneCountryCode || digits.startsWith(phoneCountryCode)) return `+${digits}`
  return `+${phoneCountryCode}${digits}`
}

export function isValidCameroonPhone(phone) {
  return /^\+2376\d{8}$/.test(formatPhoneNumber(phone))
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
  await sendEmailVerification(credential.user)
  return createdProfile
}

export async function loginWithEmail(email, password) {
  await setPersistence(auth, browserSessionPersistence)
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  if (credential.user.emailVerified) {
    await credential.user.getIdToken(true)
    await updateDoc(doc(db, 'users', credential.user.uid), {
      emailVerified: true,
      emailVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return getUserProfile(credential.user.uid)
}

export function logout() {
  return signOut(auth)
}

export function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim())
}

export function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('Please login again.')
  return sendEmailVerification(auth.currentUser)
}

export function isCurrentEmailVerified() {
  return Boolean(auth.currentUser?.emailVerified)
}

export async function refreshEmailVerification() {
  if (!auth.currentUser) throw new Error('Please login again.')
  await auth.currentUser.reload()
  if (!auth.currentUser.emailVerified) return false
  await auth.currentUser.getIdToken(true)
  await updateDoc(doc(db, 'users', auth.currentUser.uid), {
    emailVerified: true,
    emailVerifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return true
}

export function getDashboardPath(accountType) {
  return {
    admin: '/dashboard/admin',
    customer: '/dashboard/customer',
    provider: '/dashboard/provider',
  }[accountType] || '/dashboard/customer'
}
