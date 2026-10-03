import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync('public/firebase-messaging-sw.js', 'utf8').replace('__FIREBASE_PUBLIC_CONFIG__', '{}')
function worker() {
  const listeners = {}
  let background
  const show = vi.fn(async () => {})
  const open = vi.fn(async () => {})
  const self = { location: { origin: 'https://carenest237.com' }, addEventListener: (name, callback) => { listeners[name] = callback }, registration: { showNotification: show }, clients: { matchAll: async () => [], openWindow: open } }
  runInNewContext(source, { self, URL, importScripts: () => {}, firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage: callback => { background = callback } }) } })
  return { listeners, show, open, background: payload => background(payload) }
}
describe('background FCM worker', () => {
  it('shows one notification for data messages', async () => {
    const app = worker(); await app.background({ data: { title: 'New job', body: 'Open CareNest', eventId: 'event-1', url: '/dashboard/provider?view=jobs' } })
    expect(app.show).toHaveBeenCalledTimes(1)
    expect(app.show.mock.calls[0][1]).toMatchObject({ tag: 'event-1', data: { url: '/dashboard/provider?view=jobs' } })
  })
  it('does not duplicate notifications already displayed by Firebase', async () => {
    const app = worker(); await app.background({ notification: { title: 'Firebase displayed this' } })
    expect(app.show).not.toHaveBeenCalled()
  })
  it.each(['https://malicious.example/', '/login', '/dashboard/provider?view=jobs'])('keeps notification clicks in a protected CareNest dashboard: %s', async url => {
    const app = worker(); let pending
    app.listeners.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: value => { pending = value } })
    await pending
    expect(app.open).toHaveBeenCalledWith('https://carenest237.com' + (url.startsWith('/dashboard/') ? url : '/dashboard/customer'))
  })
})
