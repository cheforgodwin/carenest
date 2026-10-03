import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const mocks = vi.hoisted(() => ({ role: 'customer', logout: vi.fn(), reauth: vi.fn(), token: vi.fn(), post: vi.fn(), signOut: vi.fn(), navigate: vi.fn(), auth: { currentUser: { uid: 'own-user' } } }))
vi.mock('../src/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'own-user', email: 'user@example.com', getIdToken: mocks.token }, profile: { accountType: mocks.role, name: 'Name' }, logout: mocks.logout }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('firebase/auth', () => ({ EmailAuthProvider: { credential: (email, password) => ({ email, password }) }, reauthenticateWithCredential: mocks.reauth, signOut: mocks.signOut }))
vi.mock('../src/firebase/firebaseConfig', () => ({ auth: mocks.auth }))
vi.mock('../src/firebase/authService', () => ({ getAuthErrorMessage: error => error.message, getDashboardPath: role => '/dashboard/' + role }))
vi.mock('../src/utils/networkUtils', () => ({ postJson: mocks.post }))
vi.mock('../src/components/NotificationControls', () => ({ default: () => <div>Notification preferences</div> }))
vi.mock('../src/pages/dashboards/DashboardShell', () => ({ default: ({ children, nav }) => <main><a href={nav[0].to}>Dashboard</a>{children}</main> }))
import SettingsPage from '../src/pages/SettingsPage'
import { deleteOwnAccount } from '../src/firebase/accountService'
const user = { uid: 'own-user', email: 'user@example.com', getIdToken: mocks.token }
beforeEach(() => {
  mocks.role = 'customer'; mocks.auth.currentUser = { uid: 'own-user' }
  for (const name of ['logout', 'reauth', 'token', 'post', 'signOut']) mocks[name].mockReset().mockResolvedValue(undefined)
  mocks.navigate.mockReset()
})
it.each(['customer', 'provider', 'rider', 'admin'])('provides settings for %s accounts', role => {
  mocks.role = role
  const html = renderToStaticMarkup(<SettingsPage />)
  expect(html).toContain('/dashboard/' + role)
  expect(html).toContain('Notification preferences')
  expect(html).toContain('Logout')
  expect(html).toContain('Delete my account')
  expect(html).toContain('Order and payment history stays on record')
})
it('requires typed confirmation before reauthentication or deletion', async () => {
  await expect(deleteOwnAccount(user, 'password', '')).rejects.toThrow('Type DELETE')
  expect(mocks.reauth).not.toHaveBeenCalled()
  expect(mocks.post).not.toHaveBeenCalled()
})
it('does not delete when password confirmation fails', async () => {
  mocks.reauth.mockRejectedValue(new Error('Wrong password'))
  await expect(deleteOwnAccount(user, 'password', 'DELETE')).rejects.toThrow('Wrong password')
  expect(mocks.post).not.toHaveBeenCalled()
})
it('refreshes authentication before requesting own-account deletion and signs out afterward', async () => {
  await deleteOwnAccount(user, 'password', 'DELETE')
  expect(mocks.token).toHaveBeenCalledWith(true)
  expect(mocks.post).toHaveBeenCalledWith('/api/account', { action: 'delete', confirmation: 'DELETE', accountUid: 'own-user' }, { timeoutMs: 60000 })
  expect(mocks.signOut).toHaveBeenCalled()
  expect(mocks.reauth.mock.invocationCallOrder[0]).toBeLessThan(mocks.token.mock.invocationCallOrder[0])
  expect(mocks.token.mock.invocationCallOrder[0]).toBeLessThan(mocks.post.mock.invocationCallOrder[0])
})
it('stops deletion when the account switches during reauthentication', async () => {
  mocks.reauth.mockImplementation(async () => { mocks.auth.currentUser = { uid: 'different-user' } })
  await expect(deleteOwnAccount(user, 'password', 'DELETE')).rejects.toThrow('account changed')
  expect(mocks.post).not.toHaveBeenCalled()
})
