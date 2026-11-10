import { describe, expect, it } from 'vitest'
import { normalizePeerDeliveryForMap } from '../src/firebase/peerDeliveryService'

describe('peer delivery map normalization', () => {
  it('converts delivery coordinates and status into the admin map shape', () => {
    expect(normalizePeerDeliveryForMap({
      id: 'PD-1001',
      status: 'rider_to_pickup',
      pickup: { address: 'Mvan', coordinates: { latitude: 3.8, longitude: 11.5 } },
      destination: { address: 'Bastos', lat: 3.9, lng: 11.6 },
      riderId: 'rider-1',
      riderLocation: { lat: 3.85, lng: 11.55 },
      payment: { status: 'paid' },
    })).toMatchObject({
      firestoreId: 'peer-PD-1001',
      id: 'PD-1001',
      status: 'Rider To Pickup',
      pickupAddress: 'Mvan',
      pickupCoordinates: { lat: 3.8, lng: 11.5 },
      address: 'Bastos',
      addressCoordinates: { lat: 3.9, lng: 11.6 },
      riderUid: 'rider-1',
      riderLocation: { lat: 3.85, lng: 11.55 },
      paymentStatus: 'paid',
    })
  })

  it('does not plot invalid or absent coordinates', () => {
    expect(normalizePeerDeliveryForMap({
      id: 'PD-1002',
      status: 'awaiting_recipient',
      pickup: { lat: 92, lng: 0 },
      destination: { address: 'Bastos' },
    })).toMatchObject({
      pickupCoordinates: null,
      addressCoordinates: null,
      address: 'Bastos',
      riderLocation: null,
    })
  })
})
