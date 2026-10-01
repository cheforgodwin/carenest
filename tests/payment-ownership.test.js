import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getDb: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ requireAuthenticatedUser: mocks.requireUser, getAdminDb: mocks.getDb }))
import handler from '../api/fapshi.js'

describe('payment ownership', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
  function validOrder() {
    const order = { customerUid: 'customer-a', customerPhone: '+237670000001', amount: 1500, paymentStatus: 'Pending', status: 'Pending' }
    const orderRef = { get: vi.fn(async () => ({ exists: true, data: () => ({ ...order }) })), update: vi.fn() }
    const records = new Map()
    let queue = Promise.resolve()
    const runTransaction = vi.fn((action) => {
      const result = queue.then(() => action({
        get: async (ref) => ref === orderRef ? { exists: true, data: () => ({ ...order }) } : { exists: records.has(ref), data: () => records.get(ref) },
        set: (ref, value) => records.set(ref, value),
        update: (ref, patch) => { if (ref === orderRef) { orderRef.update(patch); Object.assign(order, patch) } },
      }))
      queue = result.catch(() => {})
      return result
    })
    mocks.requireUser.mockResolvedValue({ uid: 'customer-a' })
    mocks.getDb.mockReturnValue({ collection: (name) => ({ doc: (id) => name === 'serviceRequests' ? orderRef : name + '/' + id }), runTransaction })
    vi.stubEnv('FAPSHI_MODE', 'sandbox')
    vi.stubEnv('FAPSHI_PAYMENT_FLOW', 'direct')
    vi.stubEnv('FAPSHI_SANDBOX_API_URL', 'https://sandbox.fapshi.com/initiate-pay')
    vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'test-user')
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return { order, orderRef, runTransaction }
  }

  it('accepts a valid alternate payment phone while keeping the saved order network', async () => {
    const { order } = validOrder()
    order.customerPhone = '+237699000661'
    order.paymentNetwork = 'mtn'
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ transId: 'tx-checkout-test' }) }))
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', phone: '+237650000999' } }, res)
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(fetch.mock.calls[0][1].body).phone).toBe('650000999')
    expect(JSON.parse(fetch.mock.calls[0][1].body).medium).toBe('mobile money')
    expect(order.customerPhone).toBe('+237699000661')
    expect(order.paymentPhone).toBe('650000999')
    expect(order.paymentNetwork).toBe('mtn')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([['mtn', 'mobile money'], ['orange', 'orange money']])('routes %s explicitly using the saved order network', async (network, medium) => {
    const { order } = validOrder()
    order.paymentNetwork = network
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ transId: 'tx-network-test' }) }))
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(fetch.mock.calls[0][1].body).medium).toBe(medium)
  })

  it.each([
    ['mtn', 'orange', '+237699000661', 'orange money'],
    ['orange', 'mtn', '+237670000001', 'mobile money'],
  ])('switches from %s to the current %s payment number', async (saved, requested, phone, medium) => {
    const { order } = validOrder()
    order.paymentNetwork = saved
    order.customerPhone = saved === 'mtn' ? '+237670000002' : '+237699000662'
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ transId: 'tx-switch', status: 'SUCCESSFUL' }) }))
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', phone, paymentNetwork: ' ' + requested.toUpperCase() + ' ', amount: 100 } }, res)
    expect(res.statusCode).toBe(202)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ phone: phone.slice(4), medium, amount: 1500, externalId: 'order-a', userId: 'customer-a' })
    expect(order.customerPhone).toBe(saved === 'mtn' ? '+237670000002' : '+237699000662')
    expect(order.paymentPhone).toBe(phone.slice(4))
    expect(order.paymentNetwork).toBe(requested)
    expect(order.paymentReference).toBe('tx-switch')
    expect(order.paymentStatus).toBe('Submitted')
  })

  it('rejects an invalid requested network even when the saved network is valid', async () => {
    const { order, runTransaction } = validOrder()
    order.paymentNetwork = 'mtn'
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', paymentNetwork: 'unsupported' } }, res)
    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(runTransaction).not.toHaveBeenCalled()
    expect(order.paymentNetwork).toBe('mtn')
  })

  it('rejects an invalid phone when switching networks', async () => {
    const { order, runTransaction } = validOrder()
    order.paymentNetwork = 'mtn'
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', phone: '123', paymentNetwork: 'orange' } }, res)
    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it.each(['Starting', 'Unknown'])('cannot bypass a %s payment attempt by switching networks', async (state) => {
    const { order } = validOrder()
    Object.assign(order, { paymentNetwork: 'mtn', paymentInitiationState: state })
    if (state === 'Submitted') Object.assign(order, { paymentStatus: 'Submitted', paymentReference: 'tx-existing' })
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', phone: '+237699000661', paymentNetwork: 'orange' } }, res)
    expect(res.statusCode).toBe(409)
    expect(fetch).not.toHaveBeenCalled()
    expect(order.paymentNetwork).toBe('mtn')
  })

  it('rejects unsupported network settings before requesting money', async () => {
    const { order, runTransaction } = validOrder()
    order.paymentNetwork = 'unsupported'
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(runTransaction).not.toHaveBeenCalled()
  })

  function previousAttempt(order, paymentStatus = 'Submitted') {
    Object.assign(order, {
      paymentStatus, paymentReference: 'tx-old', paymentReceiptTransactionId: 'tx-old',
      paymentInitiationId: 'attempt-old', paymentInitiationState: 'Submitted',
      paymentEnvironment: 'sandbox', paymentNetwork: 'mtn', paymentPhone: '670000002',
    })
  }

  function verifiedResponse(status, patch = {}) {
    return { transId: 'tx-old', externalId: 'order-a', userId: 'customer-a', amount: 1500, transType: 'Collection', status, ...patch }
  }

  function mockProvider(payment) {
    const fetch = vi.fn(async (url) => ({
      ok: true, status: 200,
      text: async () => JSON.stringify(url.endsWith('/direct-pay') ? { transId: 'tx-new', status: 'SUCCESSFUL' } : payment),
    }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it.each([
    ['FAILED', 'Pending'], ['FAILED', 'Submitted'], ['FAILED', 'Failed'],
    ['EXPIRED', 'Pending'], ['EXPIRED', 'Submitted'], ['EXPIRED', 'Failed'],
  ])('reconciles %s before retrying a locally %s payment', async (status, localStatus) => {
    const { order } = validOrder()
    previousAttempt(order, localStatus)
    const fetch = mockProvider(verifiedResponse(status))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a', paymentPhone: '+237699000661', paymentNetwork: 'orange' } }, res)
    expect(res.statusCode).toBe(202)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain('/payment-status/tx-old')
    expect(fetch.mock.calls[1][0]).toContain('/direct-pay')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ phone: '699000661', medium: 'orange money', amount: 1500 })
    expect(order).toMatchObject({ customerPhone: '+237670000001', paymentPhone: '699000661', paymentNetwork: 'orange', paymentReference: 'tx-new', paymentReceiptTransactionId: 'tx-new', paymentStatus: 'Submitted', paymentRetiredReferences: ['tx-old'], paymentVerifiedAt: null })
    expect(order.paymentInitiationId).not.toBe('attempt-old')
  })

  it.each(['PENDING', 'CREATED', 'SUCCESSFUL'])('blocks retry after Fapshi confirms %s', async (status) => {
    const { order } = validOrder()
    previousAttempt(order)
    const fetch = mockProvider(verifiedResponse(status))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(409)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/payment-status/tx-old')
    expect(order.paymentReference).toBe('tx-old')
    expect(order.paymentStatus).toBe(status === 'SUCCESSFUL' ? 'Paid' : 'Submitted')
  })

  it('does not treat stale failed metadata as permission to retry a currently pending payment', async () => {
    const { order } = validOrder()
    previousAttempt(order, 'Failed')
    Object.assign(order, { paymentVerifiedAt: new Date(), paymentProviderStatus: 'FAILED' })
    const fetch = mockProvider(verifiedResponse('PENDING'))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(409)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(order.paymentReference).toBe('tx-old')
  })

  it.each(['network', 'unavailable', 'unknown', 'mismatch', 'environment'])('blocks retry when verification has a %s outcome', async (failure) => {
    const { order } = validOrder()
    previousAttempt(order)
    if (failure === 'environment') order.paymentEnvironment = 'live'
    const fetch = vi.fn(async () => {
      if (failure === 'network') throw new TypeError('connection lost')
      return { ok: failure !== 'unavailable', status: 503, text: async () => JSON.stringify(verifiedResponse(failure === 'unknown' ? 'UNKNOWN' : 'FAILED', failure === 'mismatch' ? { amount: 100 } : {})) }
    })
    vi.stubGlobal('fetch', fetch)
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(order.paymentReference).toBe('tx-old')
    expect(order.paymentInitiationId).toBe('attempt-old')
  })

  it('rechecks the payment inside the retry lock when success arrives concurrently', async () => {
    const { order, runTransaction } = validOrder()
    previousAttempt(order)
    const original = runTransaction.getMockImplementation()
    runTransaction.mockImplementation((action) => {
      if (runTransaction.mock.calls.length === 4) Object.assign(order, { paymentStatus: 'Paid', paymentProviderStatus: 'SUCCESSFUL' })
      return original(action)
    })
    const fetch = mockProvider(verifiedResponse('FAILED'))
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(409)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(order.paymentStatus).toBe('Paid')
    expect(order.paymentReference).toBe('tx-old')
  })

  it('allows only one new charge for simultaneous retries', async () => {
    const { order } = validOrder()
    previousAttempt(order)
    const fetch = mockProvider(verifiedResponse('EXPIRED'))
    const responses = [{ setHeader: vi.fn(), end: vi.fn() }, { setHeader: vi.fn(), end: vi.fn() }]
    await Promise.all(responses.map((res) => handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)))
    expect(responses.filter((res) => res.statusCode === 202)).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/direct-pay'))).toHaveLength(1)
  })

  it('uses the saved payer phone without changing the contact number', async () => {
    const { order } = validOrder()
    order.paymentPhone = '+237699000661'
    const fetch = mockProvider({})
    const res = { setHeader: vi.fn(), end: vi.fn() }
    await handler({ method: 'POST', headers: {}, body: { firestoreId: 'order-a' } }, res)
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(fetch.mock.calls[0][1].body).phone).toBe('699000661')
    expect(order.customerPhone).toBe('+237670000001')
    expect(order.paymentPhone).toBe('699000661')
  })

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
