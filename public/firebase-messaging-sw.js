/* global firebase, importScripts, self, URL */
// Separate push scope keeps CareNest's offline service worker intact.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const candidate = new URL(event.notification.data?.url || '/dashboard/customer', self.location.origin)
  const url = candidate.origin === self.location.origin && candidate.pathname.startsWith('/dashboard/') ? candidate.href : self.location.origin + '/dashboard/customer'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) { await client.navigate(url); return client.focus() }
    }
    return self.clients.openWindow(url)
  })())
})
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')
firebase.initializeApp(__FIREBASE_PUBLIC_CONFIG__)
firebase.messaging().onBackgroundMessage(payload => {
  if (payload.notification) return // FCM displays notification payloads itself.
  const data = payload.data || {}
  return self.registration.showNotification(data.title || 'CareNest update', {
    body: data.body || 'Open CareNest for details.', icon: '/logo.svg', badge: '/logo.svg',
    tag: data.eventId || 'carenest-update', data: { url: data.url || '/dashboard/customer' },
  })
})
