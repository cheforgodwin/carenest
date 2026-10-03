import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { memoryDb } from './helpers/memory-db.js'
const mocks = vi.hoisted(() => ({ db: null, auth: vi.fn(), notify: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ getAdminDb: () => mocks.db, requireAuthenticatedUser: mocks.auth }))
vi.mock('../api/_notifications.js', () => ({ notifyOrder: mocks.notify }))
import jobs from '../api/jobs.js'
import notifications from '../api/notifications.js'
let records
const order = { id: 'CN-100', customerUid: 'customer', customerPhone: '673000001', paymentPhone: '650000001', address: 'Private home address', amount: 5000, status: 'Pending', paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: 'fapshi-webhook', paymentReference: 'tx-paid' }
const token = 'A'.repeat(35) + ':device-token'
const hash = createHash('sha256').update(token).digest('hex')
async function call(handler, body) {
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method: 'POST', headers: {}, body }, res)
  return res
}
beforeEach(() => {
  const fixture = memoryDb([['users/provider', { accountType: 'provider', name: 'Provider' }], ['users/other', { accountType: 'provider', name: 'Other' }], ['users/customer', { accountType: 'customer' }], ['serviceRequests/order-a', { ...order }]])
  records = fixture.records; mocks.db = fixture.db
  mocks.auth.mockReset().mockResolvedValue({ uid: 'provider' }); mocks.notify.mockReset().mockResolvedValue(undefined)
})
describe('self-service provider jobs', () => {
  it('lists only eligible paid jobs without private customer details', async () => {
    records.set('serviceRequests/unpaid', { ...order, paymentStatus: 'Pending' })
    records.set('serviceRequests/unverified', { ...order, paymentVerifiedBy: 'admin' })
    records.set('serviceRequests/held', { ...order, payoutStatus: 'Held' })
    records.set('serviceRequests/taken', { ...order, providerUid: 'other' })
    const res = await call(jobs, { action: 'list' })
    expect(res.statusCode).toBe(200); expect(res.body.jobs).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toContain('Private home address')
    expect(JSON.stringify(res.body)).not.toContain('650000001')
  })
  it('allows exactly one simultaneous acceptance and preserves payment/contact details', async () => {
    mocks.auth.mockResolvedValueOnce({ uid: 'provider' }).mockResolvedValueOnce({ uid: 'other' })
    const results = await Promise.all([call(jobs, { action: 'accept', orderId: 'order-a' }), call(jobs, { action: 'accept', orderId: 'order-a' })])
    expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
    expect(records.get('serviceRequests/order-a')).toMatchObject({ providerUid: 'provider', providerAcceptedBy: 'provider', status: 'Assigned', paymentReference: 'tx-paid', customerPhone: '673000001', paymentPhone: '650000001', amount: 5000 })
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })
  it.each([{ paymentStatus: 'Pending' }, { paymentVerifiedAt: null }, { refundStatus: 'Requested' }, { disputeStatus: 'Open' }, { providerUid: 'other' }, { paymentEnvironment: 'sandbox' }])('cannot claim unavailable jobs %j', async patch => {
    records.set('serviceRequests/order-a', { ...order, ...patch })
    expect((await call(jobs, { action: 'accept', orderId: 'order-a' })).statusCode).toBe(409)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('requires an approved provider role', async () => {
    mocks.auth.mockResolvedValue({ uid: 'customer' })
    expect((await call(jobs, { action: 'list' })).statusCode).toBe(403)
    expect((await call(jobs, { action: 'accept', orderId: 'order-a' })).statusCode).toBe(403)
  })
})
describe('FCM device ownership', () => {
  it('saves each token beneath its user and derives the role server-side', async () => {
    expect((await call(notifications, { action: 'register', token, role: 'admin' })).statusCode).toBe(200)
    expect(records.get('pushSubscriptions/' + hash)).toMatchObject({ uid: 'provider', token, role: 'provider' })
    expect(records.get('users/provider/fcmTokens/' + hash)).toMatchObject({ token })
  })
  it('moves a shared device to the new signed-in user', async () => {
    await call(notifications, { action: 'register', token })
    mocks.auth.mockResolvedValue({ uid: 'customer' })
    await call(notifications, { action: 'register', token })
    expect(records.has('users/provider/fcmTokens/' + hash)).toBe(false)
    expect(records.get('pushSubscriptions/' + hash).uid).toBe('customer')
  })
  it('rejects removal of another users device', async () => {
    await call(notifications, { action: 'register', token })
    mocks.auth.mockResolvedValue({ uid: 'customer' })
    expect((await call(notifications, { action: 'unregister', token })).statusCode).toBe(403)
    expect(records.has('pushSubscriptions/' + hash)).toBe(true)
  })
  it('unregisters both copies of the current device', async () => {
    await call(notifications, { action: 'register', token })
    await call(notifications, { action: 'unregister', token })
    expect(records.has('pushSubscriptions/' + hash)).toBe(false)
    expect(records.has('users/provider/fcmTokens/' + hash)).toBe(false)
  })
  it('cannot generate updates for an unrelated order', async () => {
    expect((await call(notifications, { action: 'syncOrder', orderId: 'order-a', paymentStatus: 'Paid' })).statusCode).toBe(403)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('requires authentication and rejects malformed tokens', async () => {
    expect((await call(notifications, { action: 'register', token: 'bad' })).statusCode).toBe(400)
    mocks.auth.mockRejectedValue(Object.assign(new Error('Sign in'), { statusCode: 401 }))
    expect((await call(notifications, { action: 'register', token })).statusCode).toBe(401)
  })
})
