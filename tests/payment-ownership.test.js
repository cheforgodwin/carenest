import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getDb: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ requireAuthenticatedUser: mocks.requireUser, getAdminDb: mocks.getDb }))
import handler from '../api/fapshi.js'

describe('payment ownership', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
  function validOrder() {
    const order = { customerUid: 'customer-a', customerPhone: '+237670000001', amount: 1500, paymentStatus: 'Pending' }
    const orderRef = { get: vi.fn(async () => ({ exists: true, data: () => order })), update: vi.fn() }
    const rateRef = {}
    const runTransaction = vi.fn(async (action) => action({
      get: async (ref) => ref === orderRef ? { exists: true, data: () => order } : { data: () => ({}) },
      set: vi.fn(), update: vi.fn(),
    }))
    mocks.requireUser.mockResolvedValue({ uid: 'customer-a' })
    mocks.getDb.mockReturnValue({ collection: (name) => ({ doc: () => name === 'serviceRequests' ? orderRef : rateRef }), runTransaction })
    vi.stubEnv('FAPSHI_MODE', 'sandbox')
    vi.stubEnv('FAPSHI_SANDBOX_API_URL', 'https://sandbox.fapshi.com/initiate-pay')
    vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'test-user')
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'test-key')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return { orderRef, runTransaction }
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
