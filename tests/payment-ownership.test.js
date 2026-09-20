import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), getDb: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({ requireAuthenticatedUser: mocks.requireUser, getAdminDb: mocks.getDb }))
import handler from '../api/fapshi.js'

describe('payment ownership', () => {
  beforeEach(() => vi.clearAllMocks())
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
