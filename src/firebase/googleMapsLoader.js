const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
let placesPromise

export function loadGooglePlacesLibrary() {
  if (!apiKey || typeof window === 'undefined') return Promise.resolve(null)
  if (window.google?.maps?.importLibrary) return window.google.maps.importLibrary('places')
  if (placesPromise) return placesPromise

  placesPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-carenest-google-maps]')
    const script = existingScript || document.createElement('script')
    const callbackName = '__carenestGoogleMapsReady'
    const cleanup = () => { try { delete window[callbackName] } catch { window[callbackName] = undefined } }
    const finish = () => {
      cleanup()
      if (window.google?.maps?.importLibrary) window.google.maps.importLibrary('places').then(resolve, reject)
      else reject(new Error('Google Maps JavaScript API did not initialize.'))
    }
    window[callbackName] = finish
    script.addEventListener('error', () => { cleanup(); reject(new Error('Google Maps JavaScript API could not load.')) }, { once: true })
    if (!existingScript) {
      const params = new URLSearchParams({ key: apiKey, v: 'weekly', loading: 'async', callback: callbackName })
      script.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString()
      script.async = true
      script.dataset.carenestGoogleMaps = 'true'
      document.head.appendChild(script)
    }
  }).catch((error) => { placesPromise = undefined; throw error })
  return placesPromise
}

