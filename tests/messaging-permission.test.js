import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ token: vi.fn(), remove: vi.fn(), post: vi.fn(), supported: vi.fn(), auth: { currentUser: { uid: 'customer' } } }))
vi.mock('../src/firebase/firebaseConfig', () => ({ app: {}, auth: mocks.auth }))
vi.mock('../src/utils/networkUtils', () => ({ postJson: mocks.post }))
vi.mock('firebase/messaging', () => ({ getMessaging: () => ({}), getToken: mocks.token, deleteToken: mocks.remove, isSupported: mocks.supported, onMessage: () => () => {} }))
import { enableNotifications, disableNotifications, vapidKey } from '../src/firebase/messagingService'
let register, permission, stored
beforeEach(() => {
  mocks.token.mockReset().mockResolvedValue('A'.repeat(40)); mocks.remove.mockReset().mockResolvedValue(true)
  mocks.post.mockReset().mockResolvedValue({ enabled: true }); mocks.supported.mockReset().mockResolvedValue(true)
  mocks.auth.currentUser = { uid: 'customer' }
  stored = new Map()
  register = vi.fn(async () => ({ active: {} }))
  permission = { permission: 'default', requestPermission: vi.fn(async () => 'granted') }
  vi.stubGlobal('window', { isSecureContext: true, Notification: permission })
  vi.stubGlobal('Notification', permission)
  vi.stubGlobal('navigator', { serviceWorker: { register } })
  vi.stubGlobal('localStorage', { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())
describe('notification permission and device lifecycle', () => {
  it('registers the dedicated worker and uses the supplied VAPID key', async () => {
    await enableNotifications()
    expect(permission.requestPermission).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope/', updateViaCache: 'none' })
    expect(mocks.token.mock.calls[0][1]).toMatchObject({ vapidKey, serviceWorkerRegistration: { active: {} } })
    expect(mocks.post).toHaveBeenCalledWith('/api/notifications', { action: 'register', token: 'A'.repeat(40) })
  })
  it('does not save a token when permission is denied', async () => {
    permission.requestPermission.mockResolvedValue('denied')
    await expect(enableNotifications()).rejects.toThrow('blocked')
    expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled()
  })
  it('never prompts during silent token refresh', async () => {
    await expect(enableNotifications({ requestPermission: false })).rejects.toThrow('not granted')
    expect(permission.requestPermission).not.toHaveBeenCalled()
  })
  it('prevents binding a token after the signed-in account changes', async () => {
    mocks.token.mockImplementation(async () => { mocks.auth.currentUser = { uid: 'other' }; return 'A'.repeat(40) })
    await expect(enableNotifications()).rejects.toThrow('account changed')
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalled()
  })
  it('unlinks the device on disable', async () => {
    await enableNotifications(); await disableNotifications()
    expect(mocks.post).toHaveBeenLastCalledWith('/api/notifications', { action: 'unregister', token: 'A'.repeat(40) })
    expect(stored.size).toBe(0)
  })
})
