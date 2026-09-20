// Redirect before advertising installation: a PWA belongs to its origin.
(() => {
  const canonicalOrigin = 'https://carenest237.com'
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  if (!local && window.location.origin !== canonicalOrigin) {
    window.addEventListener('beforeinstallprompt', (event) => event.preventDefault())
    window.location.replace(canonicalOrigin + window.location.pathname + window.location.search + window.location.hash)
    return
  }
  if (window.location.origin === canonicalOrigin) {
    const manifest = document.createElement('link')
    manifest.rel = 'manifest'
    manifest.href = '/manifest.webmanifest?v=3'
    document.head.appendChild(manifest)
  }
})()
