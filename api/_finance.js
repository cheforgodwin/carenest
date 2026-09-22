import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
export const entryId = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')
export const financialEntry = (order, orderId, kind, fields = {}) => ({
  orderId, orderLabel: order.id || orderId, customerUid: order.customerUid,
  currency: 'XAF', environment: order.paymentEnvironment || 'unknown', kind,
  recordedAt: FieldValue.serverTimestamp(), ...fields,
})
