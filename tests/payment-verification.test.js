import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyVerifiedPayment, fetchVerifiedPayment, reconcileOrderPayment } from '../api/_paymentVerification.js'

const payment = { transId: 'tx-a', externalId: 'order-a', userId: 'customer-a', amount: 1500, status: 'SUCCESSFUL', transType: 'Collection' }
function fixture(patch = {}) {
  const order = { customerUid: 'customer-a', amount: 1500, paymentStatus: 'Submitted', paymentReference: 'tx-a', paymentReceiptTransactionId: 'tx-a', ...patch }
  const ref = {}
  const writes = vi.fn((_, update) => Object.assign(order, update))
  let queue = Promise.resolve()
  const db = { collection: () => ({ doc: () => ref }), runTransaction: (action) => {
    const result = queue.then(() => action({ get: async () => ({ exists: true, data: () => ({ ...order }) }), update: writes }))
    queue = result.catch(() => {})
    return result
  } }
  return { db, ref, order, writes }
}
function provider(responses) {
  vi.stubEnv('FAPSHI_MODE', 'sandbox')
  vi.stubEnv('FAPSHI_SANDBOX_API_URL', 'https://sandbox.fapshi.com/initiate-pay')
  vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'test-user')
  vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'test-key')
  const fetch = vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(responses.shift()) }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('atomic payment verification', () => {
  it('applies simultaneous webhook and polling success only once', async () => {
    const { db, writes, order } = fixture()
    await Promise.all([applyVerifiedPayment(db, payment, 'fapshi-webhook'), applyVerifiedPayment(db, payment, 'fapshi-poll')])
    expect(order.paymentStatus).toBe('Paid')
    expect(writes).toHaveBeenCalledTimes(1)
  })
  it('never downgrades a paid payment when failure or pending arrives late', async () => {
    const { db, order, writes } = fixture()
    await applyVerifiedPayment(db, payment, 'fapshi-webhook')
    await applyVerifiedPayment(db, { ...payment, status: 'FAILED' }, 'fapshi-poll')
    await applyVerifiedPayment(db, { ...payment, status: 'PENDING' }, 'fapshi-poll')
    expect(order.paymentStatus).toBe('Paid')
    expect(writes).toHaveBeenCalledTimes(1)
  })
  it.each([{ userId: 'other' }, { amount: 1 }, { transId: 'other' }])('rejects mismatched bindings %j', async (patch) => {
    const { db, writes } = fixture()
    await expect(applyVerifiedPayment(db, { ...payment, ...patch }, 'fapshi-webhook')).rejects.toThrow('bound order')
    expect(writes).not.toHaveBeenCalled()
  })
  it('recovers a callback before the initiation response is saved', async () => {
    const { db, order } = fixture({ paymentReference: '', paymentReceiptTransactionId: '', paymentInitiationState: 'Starting', paymentInitiatedBy: 'customer-a' })
    await applyVerifiedPayment(db, payment, 'fapshi-webhook')
    expect(order.paymentStatus).toBe('Paid')
    expect(order.paymentReference).toBe('tx-a')
  })
  it('recovers an unanswered initiation through search and independently verifies its status', async () => {
    const { db, ref, order } = fixture({ paymentReference: '', paymentReceiptTransactionId: '', paymentInitiationState: 'Unknown', paymentInitiatedBy: 'customer-a' })
    const fetch = provider([[payment], payment])
    await reconcileOrderPayment(db, ref, 'order-a', 'customer-a')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain('/search?')
    expect(fetch.mock.calls[1][0]).toContain('/payment-status/tx-a')
    expect(order.paymentStatus).toBe('Paid')
  })
  it.each([{ matches: [] }, { matches: [payment, { ...payment, transId: 'tx-b' }] }])('keeps missing or ambiguous search results locked', async ({ matches }) => {
    const { db, ref, order } = fixture({ paymentReference: '', paymentReceiptTransactionId: '', paymentInitiationState: 'Unknown', paymentInitiatedBy: 'customer-a' })
    provider([matches])
    await expect(reconcileOrderPayment(db, ref, 'order-a', 'customer-a')).rejects.toThrow('unknown')
    expect(order.paymentInitiationState).toBe('Unknown')
    expect(order.paymentReference).toBe('')
  })
  it('rejects polling by another customer without contacting Fapshi', async () => {
    const { db, ref } = fixture()
    const fetch = provider([])
    await expect(reconcileOrderPayment(db, ref, 'order-a', 'other')).rejects.toThrow('own this order')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('throttles customer polling', async () => {
    const { db, ref } = fixture({ paymentLastCheckedAtMs: Date.now() })
    const fetch = provider([])
    await expect(reconcileOrderPayment(db, ref, 'order-a', 'customer-a')).rejects.toThrow('15 seconds')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects a payout or substituted transaction in a status response', async () => {
    provider([{ ...payment, transType: 'Payout' }, { ...payment, transId: 'other' }])
    await expect(fetchVerifiedPayment('tx-a')).rejects.toThrow('not a collection')
    await expect(fetchVerifiedPayment('tx-a')).rejects.toThrow('mismatch')
  })
})
