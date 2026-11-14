import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ db: null, auth: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ getAdminDb: () => mocks.db, requireAuthenticatedUser: mocks.auth }))
import handler from '../api/payouts.js'

let records
const key = (ref) => ref.path

function makeOrder(patch = {}) {
  return {
    amount: 10000,
    customerUid: 'customer-a',
    paymentStatus: 'Paid',
    paymentVerifiedAt: new Date(),
    paymentVerifiedBy: 'fapshi-poll',
    paymentEnvironment: 'live',
    paymentFinancials: { fapshiFee: 100 },
    financialSnapshot: { state: 'confirmed', amount: 10000, providerBps: 8000, riderBps: 0, feeBearer: 'platform' },
    status: 'Completed',
    completionConfirmedBy: 'customer-a',
    completionConfirmedAt: new Date(),
    ...patch,
  }
}

function seedWorker(role = 'provider') {
  records.set('users/worker-a', {
    accountType: role,
    providerVerified: role === 'provider',
    riderVerified: role === 'rider',
  })
  records.set('providerApplications/worker-a', {
    role,
    status: 'Approved',
    identityVerified: true,
    payoutPhoneVerified: true,
    phone: '+237670000123',
  })
  records.set('serviceRequests/order-a', makeOrder({ providerUid: 'worker-a' }))
}

function queryResult(name, field, value, limitValue = Infinity) {
  const docs = [...records.entries()]
    .filter(([path, data]) => path.startsWith(name + '/') && data[field] === value)
    .slice(0, limitValue)
    .map(([path, data]) => ({ id: path.slice(name.length + 1), data: () => data }))
  return { docs, size: docs.length }
}

async function call(body, uid) {
  if (uid) mocks.auth.mockResolvedValue({ uid })
  const res = { statusCode: 200, setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method: 'POST', headers: {}, body }, res)
  return res
}

const providerResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
})

beforeEach(() => {
  records = new Map()
  vi.stubEnv('FAPSHI_PAYOUT_MODE', 'sandbox')
  vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_API_USER', 'sandbox-payout-user')
  vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_SECRET_KEY', 'sandbox-payout-secret')
  mocks.auth.mockReset().mockResolvedValue({ uid: 'worker-a' })
  const ref = (name, id) => {
    const documentRef = { path: name + '/' + id, collection: name, id }
    documentRef.get = () => get(documentRef)
    return documentRef
  }
  const get = async (documentRef) => ({
    exists: records.has(key(documentRef)),
    data: () => records.get(key(documentRef)),
  })
  let queue = Promise.resolve()
  mocks.db = {
    collection: (name) => {
      const makeQuery = (field, value) => ({
        field, value, max: Infinity,
        where(nextField, _operator, nextValue) { return makeQuery(nextField, nextValue) },
        orderBy() { return this },
        limit(max) { this.max = max; return this },
        get() { return Promise.resolve(queryResult(name, this.field, this.value, this.max)) },
      })
      return {
        doc: (id) => ref(name, id),
        where: (field, _operator, value) => makeQuery(field, value),
      }
    },
    runTransaction: (fn) => {
      const result = queue.then(async () => {
        const writes = []
        const value = await fn({
          get,
          create: (documentRef, data) => writes.push(() => {
            if (records.has(key(documentRef))) throw new Error('Already exists')
            records.set(key(documentRef), data)
          }),
          set: (documentRef, data) => writes.push(() => records.set(key(documentRef), data)),
          update: (documentRef, data) => writes.push(() => {
            const updated = { ...records.get(key(documentRef)) }
            for (const [field, value] of Object.entries(data)) {
              if (value?.constructor?.name === 'DeleteTransform') delete updated[field]
              else updated[field] = value
            }
            records.set(key(documentRef), updated)
          }),
          delete: (documentRef) => writes.push(() => records.delete(key(documentRef))),
        })
        writes.forEach((write) => write())
        return value
      })
      queue = result.catch(() => {})
      return result
    },
  }
})

afterEach(() => vi.unstubAllEnvs())

describe('payout request API', () => {
  it('rejects unauthenticated, unverified, and non-worker users', async () => {
    mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Sign in'), { statusCode: 401 }))
    expect((await call({ action: 'balance' })).statusCode).toBe(401)
    seedWorker('customer')
    expect((await call({ action: 'balance' })).statusCode).toBe(403)
    seedWorker()
    records.set('providerApplications/worker-a', { role: 'provider', status: 'Pending' })
    expect((await call({ action: 'request', idempotencyKey: 'request-key-0001' })).statusCode).toBe(403)
  })

  it('computes available provider earnings and masks the verified destination', async () => {
    seedWorker()
    records.set('serviceRequests/order-sandbox', makeOrder({ providerUid: 'worker-a', paymentEnvironment: 'sandbox' }))
    records.set('serviceRequests/order-held', makeOrder({ providerUid: 'worker-a', disputeStatus: 'Open' }))
    records.set('serviceRequests/order-other', makeOrder({ providerUid: 'worker-b' }))
    const response = await call({ action: 'balance' })
    expect(response.statusCode, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ role: 'provider', amount: 8000, currency: 'XAF', eligibleOrderCount: 1, recipientPhone: '6700******23' })
    expect(response.body).not.toHaveProperty('orderAllocations')
  })

  it('excludes earnings already reserved by an active payout request from the available balance', async () => {
    seedWorker()
    records.set('serviceRequests/order-a', makeOrder({ providerUid: 'worker-a', payoutRequestId: 'PR-' + 'a'.repeat(64) }))
    const response = await call({ action: 'balance' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ amount: 0, eligibleOrderCount: 0 })
  })

  it('creates an idempotent request from server-calculated amounts, not client amounts', async () => {
    seedWorker()
    const request = { action: 'request', idempotencyKey: 'request-key-0001', amount: 1, recipientPhone: '+237699999999' }
    const first = await call(request)
    const retry = await call(request)
    expect(first.statusCode).toBe(201)
    expect(retry.statusCode).toBe(200)
    expect(first.body.request).toMatchObject({ status: 'requested', amount: 8000, eligibleOrderCount: 1, recipientPhone: '6700******23' })
    expect([...records.keys()].filter((path) => path.startsWith('payoutRequests/'))).toHaveLength(1)
    expect([...records.keys()].filter((path) => path.startsWith('payoutRequestLocks/'))).toHaveLength(1)
    const requestId = [...records.keys()].find((path) => path.startsWith('payoutRequests/')).slice('payoutRequests/'.length)
    const saved = records.get('payoutRequests/' + requestId)
    expect(saved).toMatchObject({ recipientPhone: '670000123', eligibleOrderCount: 1, amount: 8000 })
    expect(saved.orderAllocations).toEqual([{ orderId: 'order-a', amount: 8000 }])
    expect(records.get('serviceRequests/order-a').payoutRequestId).toBe(requestId)
    expect(saved).not.toHaveProperty('paymentStatus', 'Paid')
  })

  it('uses the rider allocation and blocks a second active request', async () => {
    seedWorker('rider')
    records.set('serviceRequests/order-a', makeOrder({
      serviceType: 'delivery', providerUid: 'provider-a', riderUid: 'worker-a',
      financialSnapshot: { state: 'confirmed', amount: 10000, providerBps: 6000, riderBps: 2000, feeBearer: 'platform' },
    }))
    const first = await call({ action: 'request', idempotencyKey: 'request-key-rider-001' })
    const second = await call({ action: 'request', idempotencyKey: 'request-key-rider-002' })
    expect(first.body.request.amount).toBe(2000)
    expect(second.statusCode).toBe(409)
  })

  it('limits request listing and closure to administrators and the request owner', async () => {
    seedWorker()
    const created = await call({ action: 'request', idempotencyKey: 'request-key-close-01' })
    const requestId = created.body.request.requestId
    expect((await call({ action: 'adminList' })).statusCode).toBe(403)
    expect((await call({ action: 'cancel', requestId }, 'worker-b')).statusCode).toBe(403)

    records.set('users/admin-a', { accountType: 'admin' })
    mocks.auth.mockResolvedValue({ uid: 'admin-a' })
    const listed = await call({ action: 'adminList' }, 'admin-a')
    expect(listed.statusCode).toBe(200)
    expect(listed.body.requests).toHaveLength(1)
    expect(listed.body.requests[0].recipientPhone).toBe('670000123')
    expect((await call({ action: 'close', requestId, note: 'Reviewed for manual processing.' }, 'admin-a')).statusCode).toBe(200)
    expect(records.get('payoutRequests/' + requestId).status).toBe('rejected')
    expect(records.has('payoutRequestLocks/worker-a')).toBe(false)
    expect(records.get('serviceRequests/order-a').payoutRequestId).toBeUndefined()
  })

  it('executes from payout credentials and records earnings only after verified provider success', async () => {
    seedWorker()
    const created = await call({ action: 'request', idempotencyKey: 'request-key-exec-001' })
    const requestId = created.body.request.requestId
    const payoutRequest = records.get('payoutRequests/' + requestId)
    records.set('users/admin-a', { accountType: 'admin' })
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/transaction/' + payoutRequest.providerUserId)) return providerResponse([])
      if (url.endsWith('/balance')) return providerResponse({ balance: 50000, currency: 'XAF' })
      if (url.endsWith('/payout')) return providerResponse({ transId: 'payout-tx-1' })
      if (url.endsWith('/payment-status/payout-tx-1')) return providerResponse({
        transId: 'payout-tx-1', transType: 'Payout', externalId: requestId,
        userId: payoutRequest.providerUserId, amount: 8000, status: 'SUCCESSFUL',
        dateConfirmed: '2026-11-14T12:00:00.000Z',
      })
      throw new Error('Unexpected Fapshi URL: ' + url)
    }))

    const response = await call({ action: 'execute', requestId }, 'admin-a')
    expect(response.statusCode, JSON.stringify(response.body)).toBe(200)
    expect(response.body.payout).toMatchObject({ status: 'paid', providerStatus: 'SUCCESSFUL' })
    expect(records.get('payoutRequests/' + requestId).status).toBe('paid')
    expect(records.get('serviceRequests/order-a')).toMatchObject({ financeTotals: { provider: 8000 }, payoutStatus: 'Paid' })
    expect(records.get('serviceRequests/order-a').payoutRequestId).toBeUndefined()
    expect(records.has('payoutServiceLocks/active')).toBe(false)
    const payoutCall = calls.find(({ url }) => url.endsWith('/payout'))
    expect(payoutCall.options.headers).toMatchObject({ apiuser: 'sandbox-payout-user', apikey: 'sandbox-payout-secret' })
    expect(JSON.parse(payoutCall.options.body)).toMatchObject({
      amount: 8000, phone: '670000123', medium: 'mobile money',
      userId: payoutRequest.providerUserId, externalId: requestId,
    })
    expect([...records.values()].some((value) => value.kind === 'provider_payout' && value.evidenceType === 'fapshi-verified-payout')).toBe(true)
  })

  it('locks uncertain payouts and forbids a second Fapshi send until reconciliation', async () => {
    seedWorker()
    const created = await call({ action: 'request', idempotencyKey: 'request-key-timeout-01' })
    const requestId = created.body.request.requestId
    const payoutRequest = records.get('payoutRequests/' + requestId)
    records.set('users/admin-a', { accountType: 'admin' })
    let payoutCalls = 0
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/transaction/' + payoutRequest.providerUserId)) return providerResponse([])
      if (url.endsWith('/balance')) return providerResponse({ balance: 50000 })
      if (url.endsWith('/payout')) {
        payoutCalls += 1
        throw new Error('network timeout')
      }
      throw new Error('Unexpected Fapshi URL: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock)

    expect((await call({ action: 'execute', requestId }, 'admin-a')).statusCode).toBe(503)
    expect(records.get('payoutRequests/' + requestId).status).toBe('unknown')
    expect(records.get('payoutServiceLocks/active').activeRequestId).toBe(requestId)
    expect((await call({ action: 'execute', requestId }, 'admin-a')).statusCode).toBe(409)
    expect(payoutCalls).toBe(1)

    const verifiedAbsent = await call({ action: 'verify', requestId }, 'admin-a')
    expect(verifiedAbsent.statusCode, JSON.stringify(verifiedAbsent.body)).toBe(200)
    expect(records.get('payoutRequests/' + requestId).status).toBe('failed')
    expect(records.has('payoutServiceLocks/active')).toBe(false)
  })
})