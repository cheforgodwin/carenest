import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PaymentFeedback from '../src/components/PaymentFeedback'

describe('verified customer payment feedback', () => {
  it.each([undefined, { paymentStatus: 'Submitted', paymentProviderStatus: 'SUCCESSFUL' }, { paymentStatus: 'Paid' }, { paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: 'admin' }])('does not show success before independent verification: %j', (order) => {
    const html = renderToStaticMarkup(<PaymentFeedback order={order} phone="650000001" />)
    expect(html).toContain('Payment request sent')
    expect(html).toContain('Verifying payment...')
    expect(html).toContain('650000001')
    expect(html).not.toContain('Payment successful')
  })
  it.each(['fapshi-webhook', 'fapshi-poll'])('shows success after %s verification', (source) => {
    const html = renderToStaticMarkup(<PaymentFeedback order={{ paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: source }} />)
    expect(html).toContain('Payment successful')
    expect(html).toContain('Your order has been submitted.')
    expect(html).not.toContain('Verifying payment...')
  })
  it('shows the payment phone instead of the contact phone', () => {
    const html = renderToStaticMarkup(<PaymentFeedback order={{ paymentStatus: 'Submitted', paymentPhone: '650000001', customerPhone: '673000001' }} />)
    expect(html).toContain('650000001')
    expect(html).not.toContain('673000001')
  })
  it('shows MTN fallback instructions only for an MTN payment phone', () => {
    expect(renderToStaticMarkup(<PaymentFeedback phone="670000001" />)).toContain('*126#')
    expect(renderToStaticMarkup(<PaymentFeedback phone="699000001" />)).not.toContain('*126#')
    expect(renderToStaticMarkup(<PaymentFeedback phone="670000001" order={{ paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: 'fapshi-poll' }} />)).not.toContain('*126#')
  })
  it('reports confirmed insufficient funds clearly', () => {
    const html = renderToStaticMarkup(<PaymentFeedback order={{ paymentStatus: 'Failed', paymentFailureCode: 'INSUFFICIENT_FUNDS' }} />)
    expect(html).toContain('Insufficient funds in your Mobile Money wallet')
    expect(html).not.toContain('did not confirm')
  })
  it('offers a balance check without inventing the reason for an unknown failure', () => {
    const html = renderToStaticMarkup(<PaymentFeedback order={{ paymentStatus: 'Failed' }} />)
    expect(html).toContain('Check that your Mobile Money wallet has enough funds')
    expect(html).toContain('did not confirm a specific failure reason')
  })
  it('offers retry guidance for failed attempts', () => {
    const html = renderToStaticMarkup(<PaymentFeedback order={{ paymentStatus: 'Failed' }} />)
    expect(html).toContain('Payment failed or expired')
    expect(html).not.toContain('Payment successful')
  })
})
