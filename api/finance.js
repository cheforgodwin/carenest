import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { applyVerifiedPayment, fetchVerifiedPayment, paymentError } from './_paymentVerification.js'
import { entryId, financialEntry } from './_finance.js'
import { validatePolicy, financialSnapshot, orderFinance, money } from '../src/utils/finance.js'

const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)) }
const text = (value, max = 500) => String(value || '').trim().slice(0, max)

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })
  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    const account = await db.collection('users').doc(user.uid).get()
    if (account.data()?.accountType !== 'admin') throw paymentError('Administrator access is required.', 403)
    const body = req.body || {}
    if (body.action === 'savePolicy') {
      let policy
      try { policy = validatePolicy(body.policy || {}) } catch (error) { throw paymentError(error.message, 400) }
      const version = randomUUID()
      const saved = { ...policy, version, approvedBy: user.uid, approvedAt: FieldValue.serverTimestamp() }
      await db.runTransaction(async (transaction) => {
        transaction.set(db.collection('financialPolicyVersions').doc(version), saved)
        transaction.set(db.collection('financialSettings').doc('current'), saved)
      })
      return send(res, 200, { message: 'Pricing saved for future payment requests. Existing allocations are unchanged.', version })
    }
    const orderId = text(body.orderId, 128)
    if (!orderId || orderId.includes('/')) throw paymentError('A valid order is required.', 400)
    const orderRef = db.collection('serviceRequests').doc(orderId)
    if (body.action === 'verifyPayment') {
      const order = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(orderRef)
        if (!snapshot.exists) throw paymentError('Order not found.', 404)
        const current = snapshot.data()
        if (Date.now() - Number(current.paymentLastCheckedAtMs || 0) < 15000) throw paymentError('Wait 15 seconds before checking again.', 429)
        transaction.update(orderRef, { paymentLastCheckedAtMs: Date.now() })
        return current
      })
      if (!order.paymentReference) throw paymentError('No transaction reference is saved. Use customer payment recovery or investigate with Fapshi.')
      const payment = await fetchVerifiedPayment(order.paymentReference)
      await applyVerifiedPayment(db, payment, 'fapshi-poll', orderId)
      return send(res, 200, { message: 'Payment and available Fapshi fee verified.' })
    }
    if (body.action === 'allocate') {
      const note = text(body.note)
      if (note.length < 8) throw paymentError('Explain why this historical allocation is being recorded.', 400)
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(orderRef)
        const policy = (await transaction.get(db.collection('financialSettings').doc('current'))).data()
        if (!snapshot.exists) throw paymentError('Order not found.', 404)
        const order = snapshot.data()
        if (order.financialSnapshot?.state === 'confirmed') throw paymentError('This order already has an immutable allocation.')
        if (!policy?.version) throw paymentError('Confirm pricing settings first.')
        const allocation = financialSnapshot(order, policy)
        transaction.update(orderRef, { financialSnapshot: allocation, updatedAt: FieldValue.serverTimestamp() })
        transaction.set(db.collection('financialEntries').doc(entryId('allocation', orderId)), financialEntry(order, orderId, 'allocation', { amount: order.amount, status: 'Recorded', reference: policy.version, recordedBy: user.uid, note, snapshot: allocation }))
      })
      return send(res, 200, { message: 'Historical allocation recorded using the current approved pricing.' })
    }
    if (body.action !== 'recordTransfer') throw paymentError('Unknown finance action.', 400)
    const kind = body.kind
    if (!['provider_payout', 'rider_payout', 'refund'].includes(kind)) throw paymentError('Choose a transfer type.', 400)
    if (!money(body.amount) || body.amount < 1) throw paymentError('Enter a positive whole-XAF amount.', 400)
    const reference = text(body.reference, 128)
    const method = text(body.method, 60)
    const recipient = text(body.recipient, 160)
    const note = text(body.note)
    const occurredAtMs = Date.parse(body.occurredAt)
    if (reference.length < 4 || !method || !recipient || !Number.isFinite(occurredAtMs) || occurredAtMs > Date.now() + 60000) throw paymentError('Provide the transfer reference, method, recipient and a valid transfer date.', 400)
    const transferFee = body.transferFee === null || body.transferFee === '' || body.transferFee === undefined ? null : body.transferFee
    if (transferFee !== null && !money(transferFee)) throw paymentError('Transfer fee must be a whole-XAF amount or left unknown.', 400)
    const id = entryId('transfer', method.toLowerCase(), reference.toLowerCase())
    const entryRef = db.collection('financialEntries').doc(id)
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef)
      const existing = await transaction.get(entryRef)
      if (!snapshot.exists) throw paymentError('Order not found.', 404)
      if (existing.exists) {
        const previous = existing.data()
        if (previous.orderId === orderId && previous.kind === kind && previous.amount === body.amount && previous.recipient === recipient && previous.transferFee === transferFee && previous.occurredAtMs === occurredAtMs) return
        throw paymentError('That transfer reference is already recorded. Investigate before recording another transfer.')
      }
      const order = snapshot.data()
      const f = orderFinance(order)
      if (!f.paid) throw paymentError('The customer collection must be server-verified first.')
      if (order.paymentEnvironment !== 'live') throw paymentError('Only verified live orders can record real transfers. Historical payment environment must be reconciled first.')
      const totals = { provider: 0, rider: 0, refund: 0, ...(order.financeTotals || {}) }
      const party = kind === 'provider_payout' ? 'provider' : kind === 'rider_payout' ? 'rider' : 'refund'
      if (party === 'refund') {
        if (order.refundStatus !== 'Requested') throw paymentError('Open a refund review before recording a refund.')
        if (totals.refund + body.amount > order.amount) throw paymentError('Refunds cannot exceed the verified collection.')
      } else {
        if (!f.earned || f.held) throw paymentError('Only paid, customer-confirmed work without a hold can be settled.')
        if (f.legacyTransfer) throw paymentError('An older payout status has no evidence. Reconcile it before recording another payment.')
        if (!order[party + 'Uid']) throw paymentError('Assign the recipient before recording payment.')
        const due = party === 'provider' ? f.providerDue : f.riderDue
        if (due === null) throw paymentError('Confirm the earnings split and required Fapshi fee first.')
        if (body.amount > due) throw paymentError('This transfer exceeds the outstanding earnings.')
      }
      totals[party] += body.amount
      transaction.set(entryRef, financialEntry(order, orderId, kind, { amount: body.amount, reference, method, recipient, recipientUid: party === 'refund' ? order.customerUid : order[party + 'Uid'], occurredAtMs, transferFee, note, status: 'Recorded', recordedBy: user.uid, evidenceType: 'admin-attested-transfer' }))
      transaction.update(orderRef, { financeTotals: totals, updatedAt: FieldValue.serverTimestamp(),
        ...(party === 'refund' ? { refundStatus: totals.refund === order.amount ? 'Recorded' : 'Requested', payoutStatus: 'Held' } : {}),
      })
    })
    return send(res, 200, { message: 'Transfer evidence recorded. This action does not send money.' })
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to complete the finance operation.' })
  }
}
