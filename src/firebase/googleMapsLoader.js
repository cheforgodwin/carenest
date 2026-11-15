const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
let mapsScriptPromise
const libraryPromises = new Map()

function loadMapsScript() {
  if (!apiKey || typeof window === 'undefined') return Promise.resolve(null)
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  if (mapsScriptPromise) return mapsScriptPromise

  mapsScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-carenest-google-maps]')
    const script = existingScript || document.createElement('script')
    const callbackName = '__carenestGoogleMapsReady'
    const cleanup = () => { try { delete window[callbackName] } catch { window[callbackName] = undefined } }
    const finish = () => {
      cleanup()
      if (window.google?.maps?.importLibrary) resolve(window.google.maps)
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
  }).catch((error) => { mapsScriptPromise = undefined; throw error })
  return mapsScriptPromise
}

export function loadGoogleMapsLibrary(library) {
  if (!apiKey || typeof window === 'undefined') return Promise.resolve(null)
  if (!libraryPromises.has(library)) {
    const promise = loadMapsScript().then((maps) => maps?.importLibrary(library) || null)
      .catch((error) => {
        libraryPromises.delete(library)
        throw error
      })
    libraryPromises.set(library, promise)
  }
  return libraryPromises.get(library)
}

export function loadGooglePlacesLibrary() {
  return loadGoogleMapsLibrary('places')
}

