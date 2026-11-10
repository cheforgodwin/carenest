import { FieldValue } from 'firebase-admin/firestore'
import { assertTransition, auditDelivery, deliveryError } from './_peerDelivery.js'

export async function applyVerifiedPeerDeliveryPayment(db, payment, source, expectedDeliveryId = '') {
  const deliveryId = String(payment.externalId || '').trim()
  const reference = String(payment.transId || payment.transactionId || '')
  if (!/^PD-[A-F0-9]{20}$/.test(deliveryId) || (expectedDeliveryId && deliveryId !== expectedDeliveryId)) {
    throw deliveryError('Invalid CareNest peer-delivery payment binding.', 400)
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reference)) throw deliveryError('Invalid payment transaction ID.', 400)
  const providerStatus = String(payment.status || '').toUpperCase()
  if (!['CREATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED'].includes(providerStatus)) {
    throw deliveryError('Unknown payment status.', 502)
  }

  const deliveryRef = db.collection('peerDeliveries').doc(deliveryId)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(deliveryRef)
    if (!snapshot.exists) throw deliveryError('Matching delivery was not found.', 404)
    const delivery = snapshot.data()
    const currentPayment = delivery.payment || {}
    if (currentPayment.retiredReferences?.includes(reference)) throw deliveryError('Payment belongs to a retired attempt.', 400)
    if (delivery.status !== 'awaiting_payment' && currentPayment.status !== 'paid') {
      throw deliveryError('This delivery is no longer waiting for payment.', 409)
    }

    const bound = currentPayment.reference === reference && currentPayment.receiptReference === reference
    const recoverable = !currentPayment.reference && !currentPayment.receiptReference
      && ['starting', 'unknown'].includes(currentPayment.initiationState)
      && currentPayment.initiatedBy === currentPayment.payerId
    if ((!bound && !recoverable) || !currentPayment.payerId || payment.userId !== currentPayment.payerId
      || !Number.isSafeInteger(currentPayment.amount) || Number(payment.amount) !== currentPayment.amount) {
      throw deliveryError('Payment does not match the bound delivery.', 400)
    }
    if (delivery.paymentEnvironment && payment.verifiedEnvironment && delivery.paymentEnvironment !== payment.verifiedEnvironment) {
      throw deliveryError('Payment environment mismatch.', 400)
    }

    if (currentPayment.status === 'paid') {
      return { received: true, deliveryId, paymentStatus: 'paid', status: delivery.status }
    }

    const paymentStatus = providerStatus === 'SUCCESSFUL' ? 'paid'
      : ['FAILED', 'EXPIRED'].includes(providerStatus) ? 'failed' : 'submitted'
    if (currentPayment.verifiedProviderStatus === providerStatus && currentPayment.status === paymentStatus && bound) {
      return { received: true, deliveryId, paymentStatus, status: delivery.status }
    }

    const nextStatus = paymentStatus === 'paid' && delivery.status === 'awaiting_payment'
      ? assertTransition(delivery.status, 'searching_rider')
      : delivery.status
    const updatedPayment = {
      ...currentPayment,
      reference,
      receiptReference: reference,
      provider: 'Fapshi',
      status: paymentStatus,
      verifiedProviderStatus: providerStatus,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedBy: source,
      ...(payment.dateConfirmed ? { confirmedAt: payment.dateConfirmed } : {}),
      ...(paymentStatus === 'paid' ? { paidAt: FieldValue.serverTimestamp() } : {}),
    }
    transaction.update(deliveryRef, {
      payment: updatedPayment,
      ...(payment.verifiedEnvironment ? { paymentEnvironment: payment.verifiedEnvironment } : {}),
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (paymentStatus === 'paid' && delivery.status !== nextStatus) {
      auditDelivery(transaction, db, deliveryId, { uid: currentPayment.payerId, role: 'customer' }, 'payment_verified', delivery.status, nextStatus, { source })
    }
    return { received: true, deliveryId, paymentStatus, status: nextStatus }
  })
}
