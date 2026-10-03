export function paymentFailureMessage(order) {
  return order?.paymentFailureCode === 'INSUFFICIENT_FUNDS'
    ? 'Insufficient funds in your Mobile Money wallet. Add enough funds, then retry the payment.'
    : 'Payment failed. Check that your Mobile Money wallet has enough funds, then retry. The provider did not confirm a specific failure reason.'
}
