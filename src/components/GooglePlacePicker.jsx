import { useEffect, useRef, useState } from 'react'
import { loadGooglePlacesLibrary } from '../firebase/googleMapsLoader'
import '../pages/customer/googlePlacePicker.css'

export default function GooglePlacePicker({ onSelect }) {
  const containerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const [available, setAvailable] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    let disposed = false
    let element
    let handleSelect
    let handleError
    loadGooglePlacesLibrary().then((places) => {
      if (disposed) return
      if (!places) {
        setStatus('Address search is not configured. Set VITE_GOOGLE_MAPS_API_KEY and restart the app.')
        return
      }
      if (!containerRef.current) return
      element = new places.PlaceAutocompleteElement()
      element.includedRegionCodes = ['cm']
      element.placeholder = 'Search Google Maps for this address'
      handleError = () => setStatus('Google Places could not return suggestions. Check that Places API (New) is enabled and allowed for this website key.')
      handleSelect = async ({ placePrediction }) => {
        try {
          const place = placePrediction.toPlace()
          await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] })
          const coordinates = place.location?.toJSON?.()
          if (place.formattedAddress && Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng)) {
            onSelectRef.current?.({ address: place.formattedAddress, coordinates, placeId: place.id || '' })
            setStatus('')
          } else {
            setStatus('That result did not include a usable map pin. Choose another suggestion.')
          }
        } catch {
          setStatus('Could not load that place. Choose another suggestion or try again.')
        }
      }
      element.addEventListener('gmp-error', handleError)
      element.addEventListener('gmp-select', handleSelect)
      containerRef.current.replaceChildren(element)
      setAvailable(true)
      setStatus('Try a place and city, such as “Mvan, Yaoundé”. Select one of the suggestions to confirm the pin.')
    }).catch(() => {
      if (!disposed) setStatus('Google Places could not load. Check your connection, API key, and Places API (New) access.')
    })

    return () => {
      disposed = true
      if (element) element.removeEventListener('gmp-error', handleError)
      if (element && handleSelect) element.removeEventListener('gmp-select', handleSelect)
      element?.remove()
    }
  }, [])

  return <>
    <div className={`google-place-picker${available ? ' is-available' : ''}`} ref={containerRef} aria-label="Google Maps address search" />
    {status && <small className={`google-place-picker-status${status.startsWith('Google Places could not') || status.startsWith('Address search is not') ? ' is-error' : ''}`} role={status.includes('could not') || status.startsWith('Address search is not') ? 'alert' : 'status'}>{status}</small>}
  </>
}
