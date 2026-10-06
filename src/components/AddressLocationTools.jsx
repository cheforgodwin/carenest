import { useState } from 'react'
import GooglePlacePicker from './GooglePlacePicker'
import { saveCustomerHomeAddress, saveProviderBusinessAddress } from '../firebase/addressService'
import './addressLocationTools.css'

export default function AddressLocationTools({ value, savedAddress, onChange, userUid, kind = 'home' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function select(nextAddress) {
    onChange({ ...nextAddress, source: nextAddress.source || 'manual' })
    setError('')
    setMessage('')
  }

  function useCurrentLocation() {
    setError('')
    setMessage('')
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Enter an address or choose it on the map search.')
      return
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const lat = coords.latitude
      const lng = coords.longitude
      select({ address: 'Current location', coordinates: { lat, lng }, placeId: '', source: 'current_location' })
    }, (locationError) => {
      setError(locationError.code === locationError.PERMISSION_DENIED
        ? 'Location permission was denied. Allow it in your browser settings or enter an address.'
        : 'Could not get your location. Try again or enter an address.')
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  }

  async function saveAddress() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const save = kind === 'business' ? saveProviderBusinessAddress : saveCustomerHomeAddress
      await save(userUid, value)
      setMessage(kind === 'business' ? 'Shop address saved.' : 'Home address saved.')
    } catch (saveError) {
      setError(saveError.message || 'Could not save this address.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="address-location-tools">
      <GooglePlacePicker onSelect={(place) => select({ ...place, source: 'google_places' })} />
      <div className="address-location-actions">
        {kind === 'home' && savedAddress?.address && (
          <button type="button" onClick={() => select({ ...savedAddress, source: 'saved' })}>Use saved home address</button>
        )}
        <button type="button" onClick={useCurrentLocation}>Use my current location</button>
        <button type="button" onClick={saveAddress} disabled={busy || !value?.address}>
          {busy ? 'Saving?' : kind === 'business' ? 'Save shop address' : 'Save as home address'}
        </button>
      </div>
      {value?.coordinates && <small className="address-location-coordinate-note">Precise location selected</small>}
      {error && <small className="address-location-error" role="alert">{error}</small>}
      {message && <small className="address-location-success" role="status">{message}</small>}
    </div>
  )
}
