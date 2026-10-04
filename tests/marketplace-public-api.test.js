import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getListings: vi.fn(), where: vi.fn() }))
vi.mock('../api/_firebaseAdmin.js', () => ({
  getAdminDb: () => ({
    collection: () => ({
      where: (...args) => {
        mocks.where(...args)
        return { get: mocks.getListings }
      },
    }),
  }),
}))
import handler from '../api/marketplace.js'

async function call(method = 'GET') {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value },
    end(value) { this.body = value ? JSON.parse(value) : null },
  }
  await handler({ method, headers: {} }, response)
  return response
}

describe('public marketplace API', () => {
  beforeEach(() => {
    mocks.where.mockClear()
    mocks.getListings.mockReset().mockResolvedValue({
      docs: [{
        id: 'listing-a',
        data: () => ({
          active: true,
          title: 'Gas refill',
          category: 'gas',
          description: 'Household cooking gas delivered.',
          price: 6500,
          providerName: 'Provider A',
          providerPhone: '+237600000000',
          providerUid: 'provider-a',
          serviceArea: 'Yaounde',
          unit: 'cylinder',
          stockTracked: true,
          stockQuantity: 4,
          moderationNote: 'Internal review detail',
        }),
      }],
    })
  })

  it('returns active listings with only public storefront fields and cache headers', async () => {
    const response = await call()
    expect(response.statusCode).toBe(200)
    expect(mocks.where).toHaveBeenCalledWith('active', '==', true)
    expect(response.headers['Cache-Control']).toContain('s-maxage=300')
    expect(response.body.listings).toEqual([{
      firestoreId: 'listing-a',
      title: 'Gas refill',
      description: 'Household cooking gas delivered.',
      category: 'gas',
      providerName: 'Provider A',
      serviceArea: 'Yaounde',
      turnaround: '',
      price: 6500,
      unit: 'cylinder',
      options: [],
      stockTracked: true,
      stockQuantity: 4,
    }])
  })

  it('rejects methods other than GET without reading Firestore', async () => {
    const response = await call('POST')
    expect(response.statusCode).toBe(405)
    expect(mocks.getListings).not.toHaveBeenCalled()
  })

  it('returns a user-safe error when storefront data cannot be loaded', async () => {
    mocks.getListings.mockRejectedValueOnce(new Error('private database details'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const response = await call()
    warn.mockRestore()
    expect(response.statusCode).toBe(503)
    expect(response.body.error).toBe('Storefront listings are temporarily unavailable.')
  })
})
