import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SendPackagePage from '../src/pages/customer/SendPackagePage'

it('renders an independent map-led package request without inventing a quote or tracking state', () => {
  const markup = renderToStaticMarkup(<MemoryRouter><SendPackagePage profile={{ name: 'Sender', phone: '+237670000001' }} user={{ uid: 'sender-id' }} /></MemoryRouter>)

  expect(markup).toContain('Send a package')
  expect(markup).toContain('Pickup address')
  expect(markup).toContain('Destination address')
  expect(markup).toContain('Map preview')
  expect(markup).not.toContain('1,500 XAF')
  expect(markup).not.toContain('Rider assigned')
})