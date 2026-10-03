import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from './helpers/memory-db.js'
const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}] }))
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEach: mocks.send }) }))
import { notifyOrder } from '../api/_notifications.js'
beforeEach(() => { mocks.send.mockReset().mockImplementation(async messages => ({ responses: messages.map(() => ({ success: true })) })) })
const order = { id: 'CN-100', status: 'Pending', customerUid: 'customer', amount: 5000, paymentStatus: 'Paid', paymentReference: 'tx-a', paymentVerifiedAt: 1, paymentVerifiedBy: 'fapshi-webhook', customerPhone: '673000001', address: 'Secret address' }
function setup(patch = {}) {
  return memoryDb([['users/provider', { accountType: 'provider' }], ['serviceRequests/order-a', { ...order, ...patch }], ['pushSubscriptions/c', { uid: 'customer', token: 'customer-token' }], ['pushSubscriptions/p', { uid: 'provider', token: 'provider-token' }]])
}
describe('verified order notifications', () => {
  it('sends a paid-job alert and payment confirmation only once', async () => {
    const { db } = setup()
    await Promise.all([notifyOrder(db, 'order-a'), notifyOrder(db, 'order-a')])
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const messages = mocks.send.mock.calls[0][0]
    expect(messages).toHaveLength(2)
    expect(messages.find(message => message.token === 'provider-token').data.title).toBe('New paid job available')
    expect(JSON.stringify(messages)).not.toContain('Secret address')
    expect(JSON.stringify(messages)).not.toContain('673000001')
  })
  it.each([{ paymentStatus: 'Submitted' }, { paymentVerifiedBy: 'admin' }])('does not announce unverified payment %j', async patch => {
    await notifyOrder(setup(patch).db, 'order-a')
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('does not advertise held work to providers', async () => {
    await notifyOrder(setup({ payoutStatus: 'Held' }).db, 'order-a')
    expect(mocks.send.mock.calls[0][0]).toHaveLength(1)
  })
  it('removes invalid device tokens', async () => {
    const { db, records } = setup()
    mocks.send.mockResolvedValue({ responses: [{ error: { code: 'messaging/registration-token-not-registered' } }, { success: true }] })
    await notifyOrder(db, 'order-a')
    expect(records.has('pushSubscriptions/c')).toBe(false)
  })
  it('does not fail a committed job when push delivery is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.send.mockRejectedValue(new Error('Unavailable'))
    await expect(notifyOrder(setup().db, 'order-a')).resolves.toBeUndefined()
    warning.mockRestore()
  })
})
