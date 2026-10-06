import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebaseConfig'

function cleanAddress(address) {
  const value = typeof address?.address === 'string' ? address.address.trim().slice(0, 240) : ''
  if (!value) throw new Error('Choose or enter an address first.')
  const point = address.coordinates
  const lat = Number(point?.lat)
  const lng = Number(point?.lng)
  const coordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
  return {
    address: value,
    coordinates,
    placeId: typeof address.placeId === 'string' ? address.placeId.slice(0, 200) : '',
    source: ['google_places', 'current_location', 'manual', 'saved'].includes(address.source) ? address.source : 'manual',
  }
}

async function saveProfileAddress(uid, field, address) {
  if (!uid) throw new Error('Sign in before saving an address.')
  await updateDoc(doc(db, 'users', uid), { [field]: cleanAddress(address), updatedAt: serverTimestamp() })
}

export function saveCustomerHomeAddress(uid, address) {
  return saveProfileAddress(uid, 'homeAddress', address)
}

export function saveProviderBusinessAddress(uid, address) {
  return saveProfileAddress(uid, 'businessAddress', address)
}
