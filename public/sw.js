// The production build replaces this marker whenever app assets change.
const CACHE_NAME = 'carenest-shell-__BUILD_ID__'
const SHELL_FILES = ['/manifest.webmanifest', '/app-origin.js', '/favicon.svg', '/logo.svg']

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch('/', { cache: 'reload' })
  if (!response.ok) throw new Error('App shell could not be downloaded')
  await cache.put('/', response.clone())
  const html = await response.text()
  const paths = [...html.matchAll(new RegExp('(?:src|href)="(/assets/[^"]+)"', 'g'))].map((match) => match[1])
  await cache.addAll([...new Set([...SHELL_FILES, ...paths])])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell())
  // Updates wait for the user to finish their current work.
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Retain two previous releases for open tabs without growing the cache forever.
    const oldCaches = (await caches.keys()).filter((key) => key.startsWith('carenest-shell-') && key !== CACHE_NAME)
    await Promise.all(oldCaches.slice(0, -2).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

function unavailable(navigation) {
  return new Response(navigation
    ? '<!doctype html><meta name="viewport" content="width=device-width"><title>CareNest is offline</title><main><h1>You are offline</h1><p>Reconnect and reopen CareNest. Your saved orders remain in your account.</p><button onclick="location.reload()">Try again</button></main>'
    : '', {
    status: 503,
    headers: { 'Content-Type': navigation ? 'text/html; charset=utf-8' : 'text/plain', 'Cache-Control': 'no-store' },
  })
}

async function cached(request, shell = false) {
  try {
    const cache = await caches.open(CACHE_NAME)
    return await cache.match(request) || (shell ? await cache.match('/') : await caches.match(request))
  } catch { return undefined }
}

async function networkFirst(request, navigation) {
  try {
    const response = await fetch(request, { cache: 'no-cache' })
    if (!response.ok) return await cached(request, navigation) || response
    if (response.type !== 'opaque' && !response.redirected) {
      try {
        const cache = await caches.open(CACHE_NAME)
        // Root is the release's precached shell. Never replace it with HTML
        // from a different deployment while this worker controls an older tab.
        if (!navigation) await cache.put(request, response.clone())
      } catch { /* A full cache must not break a successful network request. */ }
    }
    return response
  } catch {
    return await cached(request, navigation) || unavailable(navigation)
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate' || !url.pathname.startsWith('/assets/')) {
    event.respondWith(networkFirst(request, request.mode === 'navigate'))
    return
  }
  event.respondWith((async () => {
    const response = await cached(request)
    return response || networkFirst(request, false)
  })())
})
