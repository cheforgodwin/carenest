import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ config: vi.fn(), verify: vi.fn(), db: {} }))
vi.mock('../api/_firebaseAdmin.js', () => ({ getAdminDb: () => mocks.db }))
vi.mock('../api/_fapshiPayout.js', () => ({ getFapshiPayoutConfig: mocks.config }))
vi.mock('../api/_payoutVerification.js', () => ({ verifyPayoutWebhookTransaction: mocks.verify }))
import handler from '../api/fapshi-payout-webhook.js'

async function call(headers = {}, body = { transId: 'transaction-1' }) {
  const res = { statusCode: 200, setHeader() {}, end(value) { this.body = JSON.parse(value) } }
  await handler({ method: 'POST', headers, body }, res)
  return res
}

beforeEach(() => {
  mocks.config.mockReset().mockReturnValue({ webhookSecret: 'payout-webhook-secret' })
  mocks.verify.mockReset().mockResolvedValue({ requestId: 'PR-test', status: 'paid' })
})

describe('Fapshi payout webhook', () => {
  it('rejects missing or incorrect shared secrets before looking up a transaction', async () => {
    expect((await call()).statusCode).toBe(401)
    expect((await call({ 'x-wh-secret': 'incorrect' })).statusCode).toBe(401)
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('requires a valid transaction ID', async () => {
    expect((await call({ 'x-wh-secret': 'payout-webhook-secret' }, { transId: '../other' })).statusCode).toBe(400)
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('reverifies valid callbacks against Fapshi before settling', async () => {
    const response = await call({ 'x-wh-secret': 'payout-webhook-secret' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ requestId: 'PR-test', status: 'paid' })
    expect(mocks.verify).toHaveBeenCalledWith(mocks.db, 'transaction-1')
  })
})