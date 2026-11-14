import { FieldValue } from 'firebase-admin/firestore'
import { eligibleForPayout, orderFinance } from '../src/utils/finance.js'
import { entryId, financialEntry } from './_finance.js'
import { fapshiPayoutRequest } from './_fapshiPayout.js'

const payoutError = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode })
const supportedStatuses = new Set(['CREATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED'])

function requestReference(db, requestId) {
  return db.collection('payoutRequests').doc(requestId)
}

async function lookupByUserId(uid) {
  const { response, result } = await fapshiPayoutRequest('/transaction/' + encodeURIComponent(uid))
  if (!response.ok || !Array.isArray(result)) throw payoutError('Fapshi payout reconciliation is unavailable. Keep this request on hold and try again later.', 503)
  return result
}

function matchingTransactions(transactions, request, requestId) {
  return transactions.filter((item) => item.externalId === requestId
    && item.userId === request.providerUserId
    && item.transType === 'Payout'
    && Number(item.amount) === request.amount)
}

export async function fetchPayoutStatus(transactionId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) throw payoutError('Invalid Fapshi payout transaction ID.', 400)
  const { response, result } = await fapshiPayoutRequest('/payment-status/' + encodeURIComponent(transactionId))
  if (!response.ok) throw payoutError('Fapshi payout status is temporarily unavailable.', response.status === 429 ? 429 : 503)
  if (String(result.transId || result.transactionId || '') !== transactionId) throw payoutError('Fapshi payout transaction verification mismatch.', 502)
  return result
}

async function readLocks(transaction, db, request) {
  const workerLock = db.collection('payoutRequestLocks').doc(request.uid)
  const serviceLock = db.collection('payoutServiceLocks').doc('active')
  const [workerLockSnapshot, serviceLockSnapshot] = await Promise.all([
    transaction.get(workerLock),
    transaction.get(serviceLock),
  ])
  return { workerLock, serviceLock, workerLockSnapshot, serviceLockSnapshot }
}

function clearLocks(transaction, locks, requestId) {
  if (locks.workerLockSnapshot.data()?.activeRequestId === requestId) transaction.delete(locks.workerLock)
  if (locks.serviceLockSnapshot.data()?.activeRequestId === requestId) transaction.delete(locks.serviceLock)
}

async function clearReservations(transaction, db, request, requestId) {
  const orderRefs = (request.orderAllocations || []).map((allocation) => db.collection('serviceRequests').doc(allocation.orderId))
  const [orderSnapshots, locks] = await Promise.all([
    Promise.all(orderRefs.map((ref) => transaction.get(ref))),
    readLocks(transaction, db, request),
  ])
  for (let index = 0; index < orderRefs.length; index += 1) {
    if (orderSnapshots[index].exists && orderSnapshots[index].data().payoutRequestId === requestId) {
      transaction.update(orderRefs[index], { payoutRequestId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    }
  }
  clearLocks(transaction, locks, requestId)
}

async function finishWithoutPayment(db, requestId, status, note, providerStatus = '') {
  const ref = requestReference(db, requestId)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
    const request = snapshot.data()
    if (request.status === 'paid' || request.status === 'failed' || request.status === 'cancelled' || request.status === 'rejected') return
    await clearReservations(transaction, db, request, requestId)
    transaction.update(ref, {
      status,
      providerStatus,
      resolutionNote: note,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

function validateProviderTransaction(providerTransaction, request, requestId) {
  const transactionId = String(providerTransaction.transId || providerTransaction.transactionId || '')
  const status = String(providerTransaction.status || '').toUpperCase()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) throw payoutError('Fapshi returned an invalid payout transaction ID.', 400)
  if (providerTransaction.transType !== 'Payout') throw payoutError('Fapshi transaction is not a payout.', 400)
  if (providerTransaction.externalId !== requestId || providerTransaction.userId !== request.providerUserId) {
    throw payoutError('Fapshi payout does not match the saved CareNest request.', 400)
  }
  if (Number(providerTransaction.amount) !== request.amount) throw payoutError('Fapshi payout amount does not match the saved request.', 400)
  if (!supportedStatuses.has(status)) throw payoutError('Fapshi returned an unknown payout status.', 502)
  return { transactionId, status }
}

export async function applyVerifiedPayoutStatus(db, requestId, providerTransaction, source) {
  if (!/^PR-[a-f0-9]{64}$/.test(String(requestId))) throw payoutError('Invalid payout request reference.', 400)
  const ref = requestReference(db, requestId)
  const currentSnapshot = await ref.get()
  if (!currentSnapshot.exists) throw payoutError('Matching payout request not found.', 404)
  const current = currentSnapshot.data()
  const { transactionId, status } = validateProviderTransaction(providerTransaction, current, requestId)
  const request = { ...current, transactionId }

  if (status === 'FAILED' || status === 'EXPIRED') {
    await finishWithoutPayment(db, requestId, 'failed', 'Fapshi reported a final unsuccessful payout.', status)
    return { requestId, status: 'failed', providerStatus: status }
  }
  if (status === 'CREATED' || status === 'PENDING') {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
      const saved = snapshot.data()
      if (saved.status === 'paid') return
      if (!['submitting', 'submitted', 'unknown'].includes(saved.status)) throw payoutError('Payout request is not awaiting provider status.', 409)
      transaction.update(ref, {
        status: 'submitted',
        transactionId,
        providerStatus: status,
        lastVerifiedAt: FieldValue.serverTimestamp(),
        verificationSource: source,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    return { requestId, status: 'submitted', providerStatus: status }
  }

  const allocations = request.orderAllocations
  if (!Array.isArray(allocations) || allocations.length === 0
    || allocations.reduce((sum, item) => sum + item.amount, 0) !== request.amount) {
    throw payoutError('Saved payout allocation is invalid. Contact support before proceeding.', 409)
  }

  await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(ref)
    if (!requestSnapshot.exists) throw payoutError('Payout request not found.', 404)
    const saved = requestSnapshot.data()
    if (saved.status === 'paid') return
    if (!['submitting', 'submitted', 'unknown'].includes(saved.status)) throw payoutError('Payout request is not awaiting provider status.', 409)
    const orderRefs = allocations.map((item) => db.collection('serviceRequests').doc(item.orderId))
    const entryRefs = allocations.map((item) => db.collection('financialEntries').doc(entryId('fapshi-payout', transactionId, item.orderId)))
    const snapshots = await Promise.all(orderRefs.map((orderRef) => transaction.get(orderRef)))
    const entries = await Promise.all(entryRefs.map((entryRef) => transaction.get(entryRef)))
    const locks = await readLocks(transaction, db, saved)
    for (let index = 0; index < allocations.length; index += 1) {
      const allocation = allocations[index]
      const orderSnapshot = snapshots[index]
      if (!orderSnapshot.exists || orderSnapshot.data().payoutRequestId !== requestId) {
        throw payoutError('A payout reservation is missing. Contact support before proceeding.', 409)
      }
      if (entries[index].exists) throw payoutError('This Fapshi payout is already recorded against an order.', 409)
    }

    for (let index = 0; index < allocations.length; index += 1) {
      const allocation = allocations[index]
      const orderRef = orderRefs[index]
      const order = snapshots[index].data()
      const finance = orderFinance(order)
      const party = saved.role === 'provider' ? 'provider' : 'rider'
      const due = party === 'provider' ? finance.providerDue : finance.riderDue
      if (!eligibleForPayout(order) || order.paymentEnvironment !== 'live' || !Number.isSafeInteger(due) || due < allocation.amount) {
        throw payoutError('An allocated order is no longer eligible. Contact support before proceeding.', 409)
      }
      const totals = { provider: 0, rider: 0, refund: 0, ...(order.financeTotals || {}) }
      totals[party] += allocation.amount
      const nextFinance = orderFinance({ ...order, financeTotals: totals })
      const payoutStatus = nextFinance.held ? 'Held'
        : nextFinance.providerDue === 0 && nextFinance.riderDue === 0 ? 'Paid'
          : totals.provider || totals.rider ? 'Partial' : 'Ready'
      transaction.update(orderRef, {
        financeTotals: totals,
        payoutStatus,
        payoutRequestId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.create(entryRefs[index], financialEntry(order, allocation.orderId, saved.role + '_payout', {
        amount: allocation.amount,
        reference: transactionId,
        transactionId,
        recipient: saved.recipientPhone,
        recipientUid: saved.uid,
        method: saved.medium,
        transferFee: null,
        occurredAtMs: Date.parse(providerTransaction.dateConfirmed || providerTransaction.dateInitiated || '') || null,
        status: 'SUCCESSFUL',
        source,
        payoutRequestId: requestId,
        evidenceType: 'fapshi-verified-payout',
      }))
    }
    clearLocks(transaction, locks, requestId)
    transaction.update(ref, {
      status: 'paid',
      transactionId,
      providerStatus: status,
      verifiedAt: FieldValue.serverTimestamp(),
      verificationSource: source,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  return { requestId, status: 'paid', providerStatus: status }
}

export async function reconcilePayout(db, requestId, source = 'admin-poll') {
  const ref = requestReference(db, requestId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
  const request = snapshot.data()
  if (request.status === 'paid') return { requestId, status: 'paid', providerStatus: request.providerStatus }
  if (!['submitting', 'submitted', 'unknown'].includes(request.status)) {
    throw payoutError('This payout request is not awaiting provider verification.', 409)
  }

  let transactionId = request.transactionId || ''
  if (!transactionId) {
    const matches = matchingTransactions(await lookupByUserId(request.providerUserId), request, requestId)
    if (matches.length > 1) throw payoutError('Multiple Fapshi payouts match this request. Keep it locked and contact support.', 409)
    if (!matches.length) {
      await finishWithoutPayment(db, requestId, 'failed', 'Fapshi lookup confirmed no payout transaction was created.')
      return { requestId, status: 'failed', providerStatus: '' }
    }
    transactionId = String(matches[0].transId || matches[0].transactionId || '')
  }
  const providerTransaction = await fetchPayoutStatus(transactionId)
  return applyVerifiedPayoutStatus(db, requestId, providerTransaction, source)
}

export async function recordPayoutAttemptState(db, requestId, status, fields = {}) {
  const ref = requestReference(db, requestId)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
    const request = snapshot.data()
    if (!['submitting', 'submitted', 'unknown'].includes(request.status)) return
    transaction.update(ref, { status, ...fields, updatedAt: FieldValue.serverTimestamp() })
  })
}

export async function verifyPayoutWebhookTransaction(db, transactionId) {
  const providerTransaction = await fetchPayoutStatus(transactionId)
  if (providerTransaction.transType !== 'Payout') throw payoutError('Webhook transaction is not a payout.', 400)
  const requestId = String(providerTransaction.externalId || '')
  return applyVerifiedPayoutStatus(db, requestId, providerTransaction, 'fapshi-webhook')
}