import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import SendPackagePage from '../src/pages/customer/SendPackagePage'

it('renders a verified-address request form without inventing a quote or charging the customer', () => {
  const markup = renderToStaticMarkup(<MemoryRouter><SendPackagePage profile={{ name: 'Sender', phone: '+237670000001' }} user={{ uid: 'sender-id' }} /></MemoryRouter>)

  expect(markup).toContain('Send a package')
  expect(markup).toContain('Verified locations')
  expect(markup).toContain('Choose exact Cameroon addresses from Google Maps')
  expect(markup).toContain('Verify your CareNest phone')
  expect(markup).toContain('server before quoting')
  expect(markup).not.toContain('Request submission is not available yet')
})