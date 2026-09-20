import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const script = readFileSync(new URL('../public/app-origin.js', import.meta.url), 'utf8')
function boot(address) {
  const url = new URL(address)
  const location = { hostname: url.hostname, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash, replace: vi.fn() }
  const appendChild = vi.fn()
  const addEventListener = vi.fn()
  runInNewContext(script, { window: { location, addEventListener }, document: { createElement: () => ({}), head: { appendChild } } })
  return { location, appendChild, addEventListener }
}
describe('installation domain', () => {
  it.each(['https://carenest-1134.web.app', 'https://carenest-1134.firebaseapp.com', 'https://www.carenest237.com', 'https://carenest.vercel.app'])('redirects %s before offering installation', (origin) => {
    const app = boot(origin + '/dashboard/customer/orders/CN-123?tab=payment#summary')
    expect(app.location.replace).toHaveBeenCalledWith('https://carenest237.com/dashboard/customer/orders/CN-123?tab=payment#summary')
    expect(app.appendChild).not.toHaveBeenCalled()
    const event = { preventDefault: vi.fn() }
    app.addEventListener.mock.calls[0][1](event)
    expect(event.preventDefault).toHaveBeenCalled()
  })
  it('offers installation only on the canonical origin', () => {
    const app = boot('https://carenest237.com/')
    expect(app.location.replace).not.toHaveBeenCalled()
    expect(app.appendChild).toHaveBeenCalledWith({ rel: 'manifest', href: '/manifest.webmanifest?v=3' })
  })
  it('keeps localhost usable without offering installation', () => {
    const app = boot('http://localhost:5173/')
    expect(app.location.replace).not.toHaveBeenCalled()
    expect(app.appendChild).not.toHaveBeenCalled()
  })
})
