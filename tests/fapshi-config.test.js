import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFapshiConfig } from '../api/_fapshi.js'

beforeEach(() => {
  vi.stubEnv('FAPSHI_MODE', 'sandbox')
  vi.stubEnv('FAPSHI_SANDBOX_API_URL', '')
  vi.stubEnv('FAPSHI_SANDBOX_API_USER', 'test-user')
  vi.stubEnv('FAPSHI_SANDBOX_SECRET_KEY', 'test-key')
  vi.stubEnv('FAPSHI_LIVE_API_URL', '')
  vi.stubEnv('FAPSHI_LIVE_API_USER', 'live-user')
  vi.stubEnv('FAPSHI_LIVE_SECRET_KEY', 'live-key')
})
afterEach(() => vi.unstubAllEnvs())
describe('Fapshi environment configuration', () => {
  it('pairs sandbox credentials with the sandbox endpoint', () => {
    expect(getFapshiConfig()).toEqual({ apiUrl: 'https://sandbox.fapshi.com/initiate-pay', apiUser: 'test-user', apiKey: 'test-key' })
  })
  it('uses the documented live endpoint with live credentials', () => {
    vi.stubEnv('FAPSHI_MODE', 'live')
    expect(getFapshiConfig()).toEqual({ apiUrl: 'https://live.fapshi.com/initiate-pay', apiUser: 'live-user', apiKey: 'live-key' })
  })
  it.each(['https://api.fapshi.com/initiate-pay', 'https://live.fapshi.com/initiate-pay', 'https://attacker.example/initiate-pay'])('rejects a mismatched sandbox URL: %s', (url) => {
    vi.stubEnv('FAPSHI_SANDBOX_API_URL', url)
    expect(getFapshiConfig).toThrow('does not match')
  })
  it.each(['', 'your-live-secret', '<secret>', 'key with spaces'])('rejects missing or placeholder credentials', (key) => {
    vi.stubEnv('FAPSHI_LIVE_SECRET_KEY', key)
    vi.stubEnv('FAPSHI_MODE', 'live')
    expect(getFapshiConfig).toThrow('missing or contain placeholder')
  })
})
