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
  it.each([{ paymentStatus: 'Submitted' }, { paymentVerifiedBy: 'admin' }])('does not advertise unverified payment %j', async patch => {
    await notifyOrder(setup(patch).db, 'order-a')
    expect(mocks.send.mock.calls[0][0]).toHaveLength(1)
    expect(mocks.send.mock.calls[0][0][0].data.body).not.toContain('Payment confirmed')
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

it('routes admin alerts to the admin dashboard', async () => {
  const { db, records } = setup()
  records.set('users/admin', { accountType: 'admin' })
  records.set('pushSubscriptions/admin', { uid: 'admin', token: 'admin-token' })
  await notifyOrder(db, 'order-a')
  const message = mocks.send.mock.calls[0][0].find(item => item.token === 'admin-token')
  expect(message.data.title).toBe('CareNest admin update')
  expect(message.data.url).toBe('/dashboard/admin?view=requests')
})
it('notifies assigned riders and providers with their own dashboard paths', async () => {
  const { db, records } = setup({ status: 'Assigned', providerUid: 'provider', riderUid: 'rider' })
  records.set('pushSubscriptions/rider', { uid: 'rider', token: 'rider-token' })
  await notifyOrder(db, 'order-a')
  const messages = mocks.send.mock.calls[0][0]
  expect(messages.find(item => item.token === 'rider-token').data.url).toBe('/dashboard/rider?view=deliveries')
  expect(messages.find(item => item.token === 'provider-token').data.url).toBe('/dashboard/provider?view=jobs')
})
it('retries only transiently failed devices', async () => {
  mocks.send.mockResolvedValueOnce({ responses: [{ success: true }, { error: { code: 'messaging/server-unavailable' } }] })
  await notifyOrder(setup().db, 'order-a')
  expect(mocks.send).toHaveBeenCalledTimes(2)
  expect(mocks.send.mock.calls[1][0]).toHaveLength(1)
  expect(mocks.send.mock.calls[1][0][0].token).toBe('provider-token')
})
it('a later retry skips devices that already accepted the message', async () => {
  const { db, records } = setup()
  mocks.send.mockResolvedValueOnce({ responses: [{ success: true }, { error: { code: 'messaging/mismatched-credential' } }] })
  await notifyOrder(db, 'order-a')
  expect([...records.values()].find(value => value.orderId === 'order-a').status).toBe('Retry pending')
  await notifyOrder(db, 'order-a')
  expect(mocks.send.mock.calls[1][0].map(message => message.token)).toEqual(['provider-token'])
})

it('test notifications target only the signed-in account and are rate limited', async () => {
  const { sendTestNotification } = await import('../api/_notifications.js')
  const { db, records } = setup()
  records.set('users/customer', { accountType: 'customer' })
  await sendTestNotification(db, 'customer')
  expect(mocks.send.mock.calls[0][0].map(message => message.token)).toEqual(['customer-token'])
  await expect(sendTestNotification(db, 'customer')).rejects.toMatchObject({ statusCode: 429 })
})
