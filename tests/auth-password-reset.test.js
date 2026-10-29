import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {},
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  setPersistence: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}))
vi.mock('../src/firebase/firebaseConfig', () => ({ auth: mocks.auth, db: {} }))
vi.mock('../src/firebase/messagingService', () => ({ disableNotifications: vi.fn() }))
vi.mock('../src/config/businessConfig', () => ({ phoneCountryCode: '237' }))

import { requestPasswordReset } from '../src/firebase/authService'

beforeEach(() => {
  mocks.sendPasswordResetEmail.mockReset().mockResolvedValue(undefined)
})

it('sends a reset request using a normalized email address', async () => {
  await requestPasswordReset('  Person@Example.com ')

  expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(mocks.auth, 'person@example.com')
})

it('rejects invalid email addresses without contacting Firebase', () => {
  expect(() => requestPasswordReset('not-an-email')).toThrow(/valid email/i)
  expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled()
})

it('propagates Firebase reset request failures', async () => {
  const error = new Error('Firebase request failed')
  mocks.sendPasswordResetEmail.mockRejectedValue(error)

  await expect(requestPasswordReset('person@example.com')).rejects.toBe(error)
})
