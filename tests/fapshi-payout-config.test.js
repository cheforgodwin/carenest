import { afterEach, describe, expect, it, vi } from 'vitest'
import { fapshiPayoutRequest, getFapshiPayoutConfig } from '../api/_fapshiPayout.js'

afterEach(() => vi.unstubAllEnvs())

describe('Fapshi payout configuration', () => {
  it('uses a distinct sandbox credential pair by default', () => {
    vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'collection-user')
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'collection-key')
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_API_USER', 'payout-user')
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_SECRET_KEY', 'payout-key')
    expect(getFapshiPayoutConfig()).toMatchObject({
      mode: 'sandbox', origin: 'https://sandbox.fapshi.com',
      apiUser: 'payout-user', apiKey: 'payout-key',
    })
  })

  it('requires live payout approval and only reads live payout credentials', () => {
    vi.stubEnv('FAPSHI_PAYOUT_MODE', 'live')
    vi.stubEnv('FAPSHI_PAYOUT_LIVE_API_USER', 'payout-live-user')
    vi.stubEnv('FAPSHI_PAYOUT_LIVE_SECRET_KEY', 'payout-live-key')
    expect(() => getFapshiPayoutConfig()).toThrow(/Fapshi enables the payout service/)
    expect(getFapshiPayoutConfig({ allowUnapprovedLive: true })).toMatchObject({
      mode: 'live', origin: 'https://live.fapshi.com',
      apiUser: 'payout-live-user', apiKey: 'payout-live-key',
    })
    vi.stubEnv('FAPSHI_PAYOUT_LIVE_ENABLED', 'true')
    vi.stubEnv('FAPSHI_LIVE_API_USER', 'collection-live-user')
    vi.stubEnv('FAPSHI_LIVE_SECRET_KEY', 'collection-live-key')
    expect(getFapshiPayoutConfig()).toMatchObject({
      mode: 'live', origin: 'https://live.fapshi.com',
      apiUser: 'payout-live-user', apiKey: 'payout-live-key',
    })
  })

  it('fails closed when payout-specific credentials are absent', () => {
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_API_USER', '')
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_SECRET_KEY', '')
    vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'collection-user')
    vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'collection-key')
    expect(() => getFapshiPayoutConfig()).toThrow(/Fapshi payout credentials are missing/)
  })

  it('sends payout credentials only to the fixed Fapshi host', async () => {
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_API_USER', 'payout-user')
    vi.stubEnv('FAPSHI_PAYOUT_SANDBOX_SECRET_KEY', 'payout-key')
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"balance":5000}' }))
    vi.stubGlobal('fetch', fetchMock)
    await fapshiPayoutRequest('/balance')
    expect(fetchMock).toHaveBeenCalledWith('https://sandbox.fapshi.com/balance', expect.objectContaining({
      headers: { apiuser: 'payout-user', apikey: 'payout-key' },
      redirect: 'error',
    }))
    await expect(fapshiPayoutRequest('https://evil.example/payout')).rejects.toThrow(/Unsupported Fapshi payout API path/)
  })
})