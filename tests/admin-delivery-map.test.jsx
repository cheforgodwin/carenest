import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AdminDeliveryMap from '../src/pages/dashboards/AdminDeliveryMap'

const delivery = {
  firestoreId: 'delivery-1',
  id: 'CN-1001',
  status: 'Out for Delivery',
  address: 'Bastos, Yaounde',
  riderUid: 'rider-1',
  riderName: 'Rider One',
  paymentStatus: 'Paid',
}

function render(orders) {
  return renderToStaticMarkup(<AdminDeliveryMap orders={orders} selectedOrderId="delivery-1" onSelect={() => {}} />)
}

it('does not invent map markers when an order has no coordinates', () => {
  const markup = render([delivery])

  expect(markup).toContain('No location data yet')
  expect(markup).toContain('No live position')
  expect(markup).not.toContain('admin-map-marker')
})

it('plots destinations and rider positions only from supplied coordinates', () => {
  const markup = render([{ ...delivery, addressCoordinates: { lat: 3.9, lng: 11.5 }, riderLocation: { lat: 3.8, lng: 11.4, updatedAt: new Date('2026-11-08T10:00:00Z') } }])

  expect(markup).toContain('Delivery destination for CN-1001')
  expect(markup).toContain('Rider position for CN-1001')
  expect(markup).toContain('Rider One')
  expect(markup).toContain('Rider GPS')
})