import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RiderRouteMap from '../src/pages/dashboards/RiderRouteMap'

const delivery = {
  firestoreId: 'delivery-1',
  id: 'CN-1001',
  status: 'Out for Delivery',
  riderStatus: 'Picked up',
  address: 'Bastos, Yaounde',
  addressCoordinates: { lat: 3.9, lng: 11.5 },
}

function render(order) {
  return renderToStaticMarkup(<RiderRouteMap
    orders={[delivery]}
    order={order}
    transportType="Motorcycle"
    sharing={false}
    starting={false}
    onShareLocation={() => {}}
    onStopLocation={() => {}}
    onSelect={() => {}}
  />)
}

it('shows a real map and route navigation without inventing a rider GPS marker', () => {
  const markup = render(delivery)

  expect(markup).toContain('Interactive route map')
  expect(markup).toContain('Bastos, Yaounde')
  expect(markup).toContain('Open navigation')
  expect(markup).toContain('Not shared yet')
  expect(markup).not.toContain('Your GPS position for CN-1001')
})

it('shows the rider marker only when real coordinates are supplied', () => {
  const markup = render({ ...delivery, riderLocation: { lat: 3.8, lng: 11.4 } })

  expect(markup).toContain('Your GPS position for CN-1001')
  expect(markup).toContain('GPS position available')
})

it('shows pickup markers and uses verified pickup coordinates for route estimates', () => {
  const markup = render({ ...delivery, pickupCoordinates: { lat: 3.8, lng: 11.4 } })

  expect(markup).toContain('Pickup location for CN-1001')
  expect(markup).toContain('Delivery destination for CN-1001')
})