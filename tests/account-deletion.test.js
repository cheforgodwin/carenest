import { beforeEach, expect, it, vi } from 'vitest'
import { memoryDb } from './helpers/memory-db.js'
const mocks = vi.hoisted(() => ({ db: null, auth: vi.fn(), delete: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ getAdminDb: () => mocks.db, requireAuthenticatedUser: mocks.auth, getAdminAuth: () => ({ deleteUser: mocks.delete }) }))
import handler from '../api/account.js'
let records
beforeEach(() => {
  const fixture = memoryDb([['users/customer', { uid: 'customer', accountType: 'customer', email: 'private@example.com', phone: '650000001', name: 'Name' }], ['pushSubscriptions/device', { uid: 'customer', token: 'secret' }], ['users/customer/fcmTokens/device', { token: 'secret' }], ['providerApplications/customer', { name: 'Name' }]])
  records = fixture.records; mocks.db = fixture.db
  mocks.auth.mockReset().mockResolvedValue({ uid: 'customer', auth_time: Date.now() / 1000 })
  mocks.delete.mockReset().mockResolvedValue(undefined)
})
async function call(body = { action: 'delete', confirmation: 'DELETE', accountUid: 'customer' }) {
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method: 'POST', headers: {}, body }, res)
  return res
}
it('deletes only the authenticated account and its devices while retaining settled order history', async () => {
  records.set('serviceRequests/settled', { customerUid: 'customer', status: 'Completed', paymentStatus: 'Paid', amount: 5000 })
  const response = await call({ action: 'delete', confirmation: 'DELETE', accountUid: 'customer', uid: 'someone-else' })
  expect(response.statusCode).toBe(200)
  expect(mocks.delete).toHaveBeenCalledWith('customer')
  expect(records.get('users/customer').accountType).toBe('deleted')
  expect(records.get('users/customer').email).toBeUndefined()
  expect(records.has('pushSubscriptions/device')).toBe(false)
  expect(records.has('users/customer/fcmTokens/device')).toBe(false)
  expect(records.has('providerApplications/customer')).toBe(false)
  expect(records.has('serviceRequests/settled')).toBe(true)
})
it.each([
  { status: 'Pending', paymentStatus: 'Pending' },
  { status: 'Cancelled', paymentStatus: 'Submitted' },
  { status: 'Completed', paymentStatus: 'Paid', disputeStatus: 'Open' },
  { status: 'Cancelled', paymentStatus: 'Paid', amount: 5000 },
  { status: 'Completed', paymentStatus: 'Paid', providerUid: 'customer' },
])('blocks deletion with unresolved work or money %j', async patch => {
  records.set('serviceRequests/active', { customerUid: 'customer', ...patch })
  expect((await call()).statusCode).toBe(409)
  expect(mocks.delete).not.toHaveBeenCalled()
  expect(records.get('users/customer').accountType).toBe('customer')
})
it('requires explicit confirmation', async () => {
  expect((await call({ action: 'delete', confirmation: '' })).statusCode).toBe(400)
  expect(mocks.delete).not.toHaveBeenCalled()
})
it('requires recent authentication', async () => {
  mocks.auth.mockResolvedValue({ uid: 'customer', auth_time: Date.now() / 1000 - 1000 })
  expect((await call()).statusCode).toBe(401)
  expect(mocks.delete).not.toHaveBeenCalled()
})
it('protects the last administrator', async () => {
  records.set('users/customer', { uid: 'customer', accountType: 'admin' })
  expect((await call()).statusCode).toBe(409)
  records.set('users/admin-other', { accountType: 'admin' })
  expect((await call()).statusCode).toBe(200)
})
it('restores the profile and devices when authentication deletion fails', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.delete.mockRejectedValue({ code: 'auth/insufficient-permission' })
  expect((await call()).statusCode).toBe(500)
  expect(records.get('users/customer').email).toBe('private@example.com')
  expect(records.has('pushSubscriptions/device')).toBe(true)
  warning.mockRestore()
})
it('disables provider listings and clears listing contact fields', async () => {
  records.set('providerListings/item', { providerUid: 'customer', active: true, providerPhone: '650000001', providerName: 'Name' })
  expect((await call()).statusCode).toBe(200)
  expect(records.get('providerListings/item')).toMatchObject({ active: false, providerPhone: '', providerName: 'Deleted provider' })
})
it('rejects unauthenticated deletion', async () => {
  mocks.auth.mockRejectedValue(Object.assign(new Error('Authentication required'), { statusCode: 401 }))
  expect((await call()).statusCode).toBe(401)
})

it('rejects a confirmation belonging to a different signed-in account', async () => {
  expect((await call({ action: 'delete', confirmation: 'DELETE', accountUid: 'other' })).statusCode).toBe(409)
  expect(mocks.delete).not.toHaveBeenCalled()
})
