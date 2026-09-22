import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ db: null, auth: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ getAdminDb: () => mocks.db, requireAuthenticatedUser: mocks.auth }))
import handler from '../api/finance.js'
import { financialSnapshot } from '../src/utils/finance.js'
const policy = { version: 'v1', providerBps: 8000, riderBps: 0, deliveryProviderBps: 6000, deliveryRiderBps: 2000, feeBearer: 'platform' }
let records
const key = (ref) => ref.path
function seed(patch = {}) {
  records.set('serviceRequests/order-a', { id: 'CN-A', amount: 10000, customerUid: 'customer', providerUid: 'provider', riderUid: 'rider', paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: 'fapshi-poll', paymentEnvironment: 'live', status: 'Completed', completionConfirmedBy: 'customer', completionConfirmedAt: 1, financialSnapshot: financialSnapshot({ amount: 10000 }, policy), paymentFinancials: { fapshiFee: 100 }, ...patch })
}
async function call(body, method = 'POST') {
  const res = { statusCode: 200, setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method, headers: {}, body }, res)
  return res
}
const transfer = { action: 'recordTransfer', orderId: 'order-a', kind: 'provider_payout', amount: 3000, reference: 'receipt-123', method: 'Mobile Money', recipient: '237600000000', occurredAt: '2026-01-01T12:00:00Z', transferFee: 25 }
beforeEach(() => {
  records = new Map([['users/admin', { accountType: 'admin' }], ['financialSettings/current', { ...policy }]])
  mocks.auth.mockReset().mockResolvedValue({ uid: 'admin' })
  const get = async (ref) => ({ exists: records.has(key(ref)), data: () => records.get(key(ref)) })
  let queue = Promise.resolve()
  mocks.db = {
    collection: (name) => ({ doc: (id) => { const ref = { path: name + '/' + id }; ref.get = () => get(ref); return ref } }),
    runTransaction: (fn) => {
      const result = queue.then(async () => {
        const writes = []
        const value = await fn({ get, set: (ref, value) => writes.push(() => records.set(key(ref), value)), update: (ref, value) => writes.push(() => records.set(key(ref), { ...records.get(key(ref)), ...value })) })
        writes.forEach((write) => write())
        return value
      })
      queue = result.catch(() => {})
      return result
    },
  }
  seed()
})
describe('admin finance API', () => {
  it('rejects unauthenticated and non-admin access before mutation', async () => {
    mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Sign in'), { statusCode: 401 }))
    expect((await call(transfer)).statusCode).toBe(401)
    records.set('users/admin', { accountType: 'customer' })
    expect((await call(transfer)).statusCode).toBe(403)
    expect(records.get('serviceRequests/order-a').financeTotals).toBeUndefined()
  })
  it('deduplicates concurrent recordings and rejects reuse for another amount', async () => {
    const results = await Promise.all([call(transfer), call(transfer)])
    expect(results.map((r) => r.statusCode)).toEqual([200, 200])
    expect(records.get('serviceRequests/order-a').financeTotals.provider).toBe(3000)
    expect([...records.keys()].filter((k) => k.startsWith('financialEntries/'))).toHaveLength(1)
    expect((await call({ ...transfer, amount: 3500 })).statusCode).toBe(409)
  })
  it('prevents overpayment including amounts already transferred', async () => {
    expect((await call({ ...transfer, amount: 8001 })).statusCode).toBe(409)
    await call(transfer)
    expect((await call({ ...transfer, reference: 'second-123', amount: 6000 })).statusCode).toBe(409)
    expect(records.get('serviceRequests/order-a').financeTotals.provider).toBe(3000)
  })
  it.each([{ paymentStatus: 'Pending' }, { paymentEnvironment: 'sandbox' }, { paymentEnvironment: undefined }, { status: 'In Progress' }, { payoutStatus: 'Held' }, { refundStatus: 'Requested' }, { financialSnapshot: { state: 'unconfigured' } }, { payoutStatus: 'Paid' }])('blocks ineligible payouts: %j', async (patch) => {
    seed(patch)
    expect((await call(transfer)).statusCode).toBe(409)
  })
  it('tracks rider transfers separately using their approved share', async () => {
    seed({ financialSnapshot: financialSnapshot({ amount: 10000, serviceType: 'delivery' }, policy) })
    expect((await call({ ...transfer, kind: 'rider_payout', amount: 2000 })).statusCode).toBe(200)
    expect(records.get('serviceRequests/order-a').financeTotals).toMatchObject({ rider: 2000, provider: 0 })
  })
  it('records only requested refunds and limits the cumulative amount', async () => {
    expect((await call({ ...transfer, kind: 'refund' })).statusCode).toBe(409)
    seed({ refundStatus: 'Requested' })
    expect((await call({ ...transfer, kind: 'refund', amount: 6000 })).statusCode).toBe(200)
    expect((await call({ ...transfer, kind: 'refund', reference: 'second', amount: 5000 })).statusCode).toBe(409)
    expect((await call({ ...transfer, kind: 'refund', reference: 'second', amount: 4000 })).statusCode).toBe(200)
    expect(records.get('serviceRequests/order-a')).toMatchObject({ paymentStatus: 'Paid', refundStatus: 'Recorded', payoutStatus: 'Held', financeTotals: { refund: 10000 } })
  })
  it('versions pricing without rewriting existing allocations', async () => {
    const response = await call({ action: 'savePolicy', policy: { ...policy, providerBps: 7500 } })
    expect(response.statusCode).toBe(200)
    expect(records.get('financialSettings/current').providerBps).toBe(7500)
    expect(records.get('serviceRequests/order-a').financialSnapshot.providerBps).toBe(8000)
    expect(records.has('financialPolicyVersions/' + response.body.version)).toBe(true)
  })
  it('requires a reason for historical allocation and prevents replacing it', async () => {
    seed({ financialSnapshot: { state: 'unconfigured' } })
    expect((await call({ action: 'allocate', orderId: 'order-a' })).statusCode).toBe(400)
    const request = { action: 'allocate', orderId: 'order-a', note: 'Original agreement confirmed.' }
    expect((await call(request)).statusCode).toBe(200)
    expect((await call(request)).statusCode).toBe(409)
  })
})
