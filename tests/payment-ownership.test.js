import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getDb: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ requireAuthenticatedUser: mocks.requireUser, getAdminDb: mocks.getDb }))
import handler from '../api/fapshi.js'

describe('payment ownership', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
  function validOrder() {
    const order = { customerUid: 'customer-a', customerPhone: '+237670000001', amount: 1500, paymentStatus: 'Pending', status: 'Pending' }
    const orderRef = { get: vi.fn(async () => ({ exists: true, data: () => order })), update: vi.fn() }
    const rateRef = {}
    const runTransaction = vi.fn(async (action) => action({
      get: async (ref) => ref === orderRef ? { exists: true, data: () => order } : { data: () => ({}) },
      set: vi.fn(), update: (ref, patch) => { if (ref === orderRef) { orderRef.update(patch); Object.assign(order, patch) } },
    }))
    mocks.requireUser.mockResolvedValue({ uid: 'customer-a' })
    mocks.getDb.mockReturnValue({ collection: (name) => ({ doc: () => name === 'serviceRequests' ? orderRef : rateRef }), runTransaction })
    vi.stubEnv('FAPSHI_MODE', 'sandbox')
    vi.stubEnv('FAPSHI_PAYMENT_FLOW', 'direct')
    vi.stubEnv('FAPSHI_SANDBOX_API_URL', 'https://sandbox.fapshi.com/initiate-pay')
    vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'test-user')
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return { order, orderRef, runTransaction }
  }

  it('rejects invalid configuration before acquiring a payment lock', async () => {
    const { runTransaction } = validOrder()
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.end.mock.calls[0][0]).code).toBe('PAYMENT_CONFIGURATION_ERROR')
    expect(runTransaction).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['hosted', 'initiate', 'driect'])('rejects a non-prompt payment flow before creating a request: %s', async (flow) => {
    const { runTransaction } = validOrder()
    vi.stubEnv('FAPSHI_PAYMENT_FLOW', flow)
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.end.mock.calls[0][0]).code).toBe('PAYMENT_CONFIGURATION_ERROR')
    expect(runTransaction).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends the normalized checkout phone to Direct Pay and stores the accepted reference', async () => {
    const { order } = validOrder()
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ transId: 'tx-test' }) }))
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(fetch.mock.calls[0][0]).toBe('https://sandbox.fapshi.com/direct-pay')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ phone: '670000001', amount: 1500, externalId: 'order-a', userId: 'customer-a' })
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.end.mock.calls[0][0]).accepted).toBe(true)
    expect(order.paymentReference).toBe('tx-test')
    expect(order.paymentStatus).toBe('Submitted')
  })

  it('preserves the saved order and handles a provider credential rejection', async () => {
    const { orderRef } = validOrder()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'Invalid apiuser or apikey' }) })))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.end.mock.calls[0][0])
    expect(body.code).toBe('PAYMENT_PROVIDER_AUTH_FAILED')
    expect(body.error).toContain('Your order is saved')
    expect(body.error).not.toContain('apiuser')
    expect(orderRef.update).toHaveBeenCalledWith(expect.objectContaining({ paymentInitiationState: 'Failed' }))
  })

  it.each([
    ['Direct pay is not enabled for this service', 'PAYMENT_PROVIDER_ACCESS_DENIED'],
    ['Forbidden', 'PAYMENT_PROVIDER_ACCESS_DENIED'],
    ['Invalid apiuser or apikey', 'PAYMENT_PROVIDER_AUTH_FAILED'],
  ])('distinguishes a 403 permission refusal from invalid credentials: %s', async (message, code) => {
    const { orderRef } = validOrder()
    const fetch = vi.fn(async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ message }) }))
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.end.mock.calls[0][0]).code).toBe(code)
    expect(orderRef.update).toHaveBeenCalledWith(expect.objectContaining({ paymentInitiationState: 'Failed' }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('never unlocks an old unanswered request just because time passed', async () => {
    const { order } = validOrder()
    Object.assign(order, { paymentInitiationState: 'Starting', paymentInitiationStartedAtMs: Date.now() - 86400000 })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(409)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['network', 'server', 'missing-reference'])('keeps %s outcomes locked against another charge', async (failure) => {
    const { order } = validOrder()
    const fetch = vi.fn(async () => {
      if (failure === 'network') throw new TypeError('connection lost')
      return { ok: failure !== 'server', status: failure === 'server' ? 500 : 200, text: async () => '{}' }
    })
    vi.stubGlobal('fetch', fetch)
    const response = () => ({ setHeader: vi.fn(), end: vi.fn() })
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, response())
    expect(order.paymentInitiationState).toBe('Unknown')
    const retry = response()
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, retry)
    expect(retry.statusCode).toBe(409)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite a webhook that arrives before the initiation response', async () => {
    const { order } = validOrder()
    vi.stubGlobal('fetch', vi.fn(async () => {
      Object.assign(order, { paymentStatus: 'Paid', paymentReference: 'tx-a', paymentReceiptTransactionId: 'tx-a' })
      return { ok: true, status: 200, text: async () => JSON.stringify({ transId: 'tx-a' }) }
    }))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(order.paymentStatus).toBe('Paid')
    expect(res.statusCode).toBe(202)
  })

  it('rejects payment for a different customer before initiating a charge', async () => {
    mocks.requireUser.mockResolvedValue({ uid: 'customer-b' })
    const get = vi.fn().mockResolvedValue({ exists: true, data: () => ({ customerUid: 'customer-a', amount: 1500 }) })
    const runTransaction = vi.fn()
    mocks.getDb.mockReturnValue({ collection: () => ({ doc: () => ({ get }) }), runTransaction })
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: { origin: 'https://carenest237.com' }, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.end.mock.calls[0][0]).error).toBe('You do not own this order.')
    expect(runTransaction).not.toHaveBeenCalled()
  })
  it('requires authentication before looking up an order', async () => {
    mocks.requireUser.mockRejectedValue(Object.assign(new Error('Authentication is required.'), { statusCode: 401 }))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(401)
    expect(mocks.getDb).not.toHaveBeenCalled()
  })
})
