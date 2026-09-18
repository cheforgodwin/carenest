import { describe, expect, it } from 'vitest'
import handler from '../api/fapshi-webhook.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(value) { this.body = JSON.parse(value) },
  }
}

describe('Fapshi webhook boundary', () => {
  it('accepts Fapshi-style requests without a custom secret header and validates the transaction ID', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': 'webhook-boundary-test' },
      body: { transId: 'invalid transaction id' },
    }
    const res = response()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Invalid Fapshi transaction ID.')
  })

  it('rejects non-POST requests', async () => {
    const res = response()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})
