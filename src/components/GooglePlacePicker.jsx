import { useEffect, useRef, useState } from 'react'
import { loadGooglePlacesLibrary } from '../firebase/googleMapsLoader'
import '../pages/customer/googlePlacePicker.css'

export default function GooglePlacePicker({ onSelect }) {
  const containerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const [available, setAvailable] = useState(false)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    let disposed = false
    let element
    let handleSelect
    loadGooglePlacesLibrary().then((places) => {
      if (!places || disposed || !containerRef.current) return
      element = new places.PlaceAutocompleteElement()
      element.includedRegionCodes = ['cm']
      element.placeholder = 'Search Google Maps for this address'
      handleSelect = async ({ placePrediction }) => {
        try {
          const place = placePrediction.toPlace()
          await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] })
          const coordinates = place.location?.toJSON?.()
          if (place.formattedAddress && Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng)) {
            onSelectRef.current?.({ address: place.formattedAddress, coordinates, placeId: place.id || '' })
          }
        } catch { /* Manual address entry remains available if place details fail. */ }
      }
      element.addEventListener('gmp-select', handleSelect)
      containerRef.current.replaceChildren(element)
      setAvailable(true)
    }).catch(() => { /* Manual address entry remains available if Google Maps is unavailable. */ })

    return () => {
      disposed = true
      if (element && handleSelect) element.removeEventListener('gmp-select', handleSelect)
      element?.remove()
    }
  }, [])

  return <div className={`google-place-picker${available ? ' is-available' : ''}`} ref={containerRef} aria-label="Google Maps address search" />
}
