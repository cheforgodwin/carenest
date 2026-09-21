import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
function worker({ cached, network, cacheFails = false } = {}) {
  const listeners = {}
  const cache = { match: vi.fn(async (key) => key === '/' ? cached : undefined), put: vi.fn(async () => { if (cacheFails) throw Error('Quota') }), addAll: vi.fn() }
  const fetch = vi.fn(network || (async () => { throw Error('Offline') }))
  const skipWaiting = vi.fn()
  const self = { location: { origin: 'https://carenest237.com' }, addEventListener: (name, fn) => { listeners[name] = fn }, skipWaiting, clients: { claim: vi.fn() } }
  runInNewContext(source, { self, caches: { open: async () => cache, match: async () => undefined }, fetch, URL, Response })
  async function request(path, mode = 'navigate', method = 'GET') {
    let promise
    listeners.fetch({ request: { url: 'https://carenest237.com' + path, mode, method }, respondWith: (value) => { promise = value } })
    return promise
  }
  return { request, cache, fetch, listeners, skipWaiting }
}
describe('service worker network recovery', () => {
  it('serves the cached app shell when navigation fails', async () => {
    const cached = new Response('<html>Cached CareNest</html>')
    const app = worker({ cached })
    expect(await app.request('/dashboard/customer')).toBe(cached)
  })
  it('returns a valid offline page when the cache is empty', async () => {
    const response = await worker().request('/dashboard/customer')
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('You are offline')
  })
  it.each(['/assets/missing.js', '/manifest.webmanifest', '/app-origin.js'])('handles failed fetches for %s without rejection', async (path) => {
    expect((await worker().request(path, 'cors')).status).toBe(503)
  })
  it('does not let a failed cache write break successful network responses', async () => {
    const app = worker({ cacheFails: true, network: async () => new Response('asset') })
    expect(await (await app.request('/assets/main.js', 'cors')).text()).toBe('asset')
  })
  it('never intercepts API requests or payment POSTs', async () => {
    const app = worker()
    expect(await app.request('/api/payments', 'cors', 'POST')).toBeUndefined()
    expect(await app.request('/api/status', 'cors')).toBeUndefined()
    expect(app.fetch).not.toHaveBeenCalled()
  })
  it('activates an update only on an explicit activation message', () => {
    const app = worker()
    expect(app.skipWaiting).not.toHaveBeenCalled()
    app.listeners.message({ data: { type: 'ACTIVATE_UPDATE' }, waitUntil: () => {} })
    expect(app.skipWaiting).toHaveBeenCalledOnce()
  })
})
