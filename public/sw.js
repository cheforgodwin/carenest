const CACHE_NAME = 'carenest-shell-v1'
const SHELL_FILES = ['/manifest.webmanifest', '/favicon.svg', '/logo.svg']

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(SHELL_FILES)

  const response = await fetch('/')
  await cache.put('/', response.clone())
  const html = await response.text()
    const assetPattern = new RegExp('(?:src|href)="(/assets/[^"]+)"', 'g')
  const assetPaths = [...html.matchAll(assetPattern)].map((match) => match[1])
  await cache.addAll([...new Set(assetPaths)])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})
