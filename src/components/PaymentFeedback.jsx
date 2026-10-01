import { confirmedCollection } from '../utils/finance'

export default function PaymentFeedback({ order, phone, titleId }) {
  const paid = order?.paymentStatus === 'Paid' && confirmedCollection(order)
  const failed = order?.paymentStatus === 'Failed'
  return <div role="status" aria-live="polite">
    <h2 id={titleId}>{paid ? 'Payment successful' : failed ? 'Payment failed or expired' : 'Payment request sent'}</h2>
    {paid ? <p>Your order has been submitted.</p> : failed ? <p>View your order to retry with your preferred payment number and network.</p> : <>
      <p>Check your phone to authorize the payment.</p>
      <p>Verifying payment...</p>
      <p>CareNest will show Paid only after the payment provider is verified by our server.</p>
      <p>Approval phone: <strong data-no-translate>{order?.paymentPhone || phone}</strong>. The prompt appears on that phone, which may be different from the device you are using now.</p>
    </>}
  </div>
}
