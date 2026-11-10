import { describe, expect, it, vi } from 'vitest'
import { applyVerifiedPeerDeliveryPayment } from '../api/_peerDeliveryPayments.js'

const deliveryId = 'PD-0123456789ABCDEF1234'
const payment = {
  externalId: deliveryId,
  transId: 'peer-payment-1',
  userId: 'payer-1',
  amount: 1500,
  status: 'SUCCESSFUL',
  verifiedEnvironment: 'sandbox',
}

function fixture(patch = {}) {
  const delivery = {
    id: deliveryId,
    status: 'awaiting_payment',
    paymentEnvironment: 'sandbox',
    payment: {
      payerId: 'payer-1',
      amount: 1500,
      status: 'submitted',
      initiationState: 'submitted',
      reference: 'peer-payment-1',
      receiptReference: 'peer-payment-1',
      retiredReferences: [],
    },
    ...patch,
  }
  const records = new Map([['peerDeliveries/' + deliveryId, delivery]])
  let auditId = 0
  const writes = vi.fn()
  const db = {
    collection: (name) => ({
      doc: (id) => `${name}/${id || `audit-${++auditId}`}`,
    }),
    runTransaction: (action) => action({
      get: async (ref) => ({ exists: records.has(ref), data: () => ({ ...records.get(ref) }) }),
      update: (ref, fields) => { writes(ref, fields); Object.assign(records.get(ref), fields) },
      create: (ref, value) => records.set(ref, value),
    }),
  }
  return { db, delivery, writes }
}

describe('peer-delivery payment verification', () => {
  it('moves an accepted delivery to dispatch only after the bound payment succeeds', async () => {
    const { db, delivery } = fixture()

    await expect(applyVerifiedPeerDeliveryPayment(db, payment, 'fapshi-webhook')).resolves.toMatchObject({
      paymentStatus: 'paid',
      status: 'searching_rider',
    })
    expect(delivery.payment.status).toBe('paid')
    expect(delivery.status).toBe('searching_rider')
  })

  it.each([{ userId: 'other-payer' }, { amount: 1 }, { transId: 'different-reference' }])(
    'rejects a provider result that is not bound to the payer, amount, and initiation',
    async (patch) => {
      const { db, delivery, writes } = fixture()

      await expect(applyVerifiedPeerDeliveryPayment(db, { ...payment, ...patch }, 'fapshi-webhook')).rejects.toThrow('bound delivery')
      expect(delivery.status).toBe('awaiting_payment')
      expect(writes).not.toHaveBeenCalled()
    },
  )

  it('does not downgrade payment or delivery status on late provider updates', async () => {
    const { db, delivery, writes } = fixture({
      status: 'searching_rider',
      payment: {
        payerId: 'payer-1',
        amount: 1500,
        status: 'paid',
        reference: 'peer-payment-1',
        receiptReference: 'peer-payment-1',
      },
    })

    await applyVerifiedPeerDeliveryPayment(db, { ...payment, status: 'FAILED' }, 'fapshi-webhook')
    expect(delivery.status).toBe('searching_rider')
    expect(delivery.payment.status).toBe('paid')
    expect(writes).not.toHaveBeenCalled()
  })
})
