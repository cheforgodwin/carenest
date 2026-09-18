import { describe, expect, it } from 'vitest'
import { handleCors } from '../api/_cors.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(value) { this.ended = true; this.body = value },
  }
}

describe('API CORS policy', () => {
  it('answers trusted production preflight requests', () => {
    const res = response()
    const handled = handleCors({ method: 'OPTIONS', headers: { origin: 'https://carenest237.com' } }, res)
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://carenest237.com')
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })

  it('rejects untrusted browser origins', () => {
    const res = response()
    const handled = handleCors({ method: 'POST', headers: { origin: 'https://attacker.example' } }, res)
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('allows server-to-server requests without an Origin header', () => {
    const res = response()
    expect(handleCors({ method: 'POST', headers: {} }, res)).toBe(false)
    expect(res.ended).toBeUndefined()
  })
})
