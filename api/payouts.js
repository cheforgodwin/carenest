import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, requireAuthenticatedUser } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'
import { eligibleForPayout, orderFinance } from '../src/utils/finance.js'
import { detectPaymentNetwork, normalizePaymentPhone } from '../src/utils/paymentNetwork.js'
import { fapshiPayoutRequest, getFapshiPayoutConfig } from './_fapshiPayout.js'
import { finishWithoutPayment, reconcilePayout, recordPayoutAttemptState } from './_payoutVerification.js'

const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}
const payoutError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const hash = (value) => createHash('sha256').update(value).digest('hex')

function maskPhone(phone) {
  return phone.slice(0, 4) + '******' + phone.slice(-2)
}

function requestView(request, id, isAdmin = false) {
  const view = {
    requestId: id,
    status: request.status,
    amount: request.amount,
    currency: request.currency,
    eligibleOrderCount: request.eligibleOrderCount,
    requestedAt: request.requestedAt,
    closedAt: request.closedAt || null,
  }
  if (isAdmin) {
    Object.assign(view, {
      uid: request.uid,
      role: request.role,
      recipientPhone: request.recipientPhone,
      orderAllocations: request.orderAllocations,
      transactionId: request.transactionId || '',
      providerStatus: request.providerStatus || '',
      closedBy: request.closedBy || null,
      closeNote: request.closeNote || '',
    })
  } else {
    view.recipientPhone = maskPhone(request.recipientPhone)
  }
  return view
}

async function requireAdmin(db, user) {
  const profile = await db.collection('users').doc(user.uid).get()
  if (profile.data()?.accountType !== 'admin') throw payoutError('Administrator access is required.', 403)
}

async function requireVerifiedWorker(db, user) {
  const [profileSnapshot, applicationSnapshot] = await Promise.all([
    db.collection('users').doc(user.uid).get(),
    db.collection('providerApplications').doc(user.uid).get(),
  ])
  const profile = profileSnapshot.data() || {}
  const application = applicationSnapshot.data() || {}
  const role = profile.accountType
  const verifiedRole = role === 'provider' ? profile.providerVerified === true : role === 'rider' && profile.riderVerified === true
  if (!verifiedRole || application.role !== role || application.status !== 'Approved'
    || application.identityVerified !== true || application.payoutPhoneVerified !== true) {
    throw payoutError('An approved provider or rider with a verified payout phone is required.', 403)
  }
  const recipientPhone = normalizePaymentPhone(application.phone)
  const network = detectPaymentNetwork(recipientPhone)
  if (!network) throw payoutError('The verified payout phone is not a supported MTN or Orange number.', 409)
  return {
    role,
    recipientPhone,
    recipientName: String(application.name || profile.name || '').trim().slice(0, 100),
    recipientEmail: String(application.email || profile.email || user.email || '').trim().slice(0, 160),
    medium: network === 'mtn' ? 'mobile money' : 'orange money',
    providerUserId: 'CN' + hash(user.uid).slice(0, 32),
  }
}

async function eligibleEarnings(db, uid, role) {
  const field = role === 'provider' ? 'providerUid' : 'riderUid'
  const snapshot = await db.collection('serviceRequests').where(field, '==', uid).limit(200).get()
  const orderAllocations = []
  for (const document of snapshot.docs) {
    const order = document.data()
    if (order.payoutRequestId || order.paymentEnvironment !== 'live' || !eligibleForPayout(order)) continue
    const finance = orderFinance(order)
    const amount = role === 'provider' ? finance.providerDue : finance.riderDue
    if (!Number.isSafeInteger(amount) || amount < 1) continue
    orderAllocations.push({ orderId: document.id, amount })
  }
  const amount = orderAllocations.reduce((total, item) => total + item.amount, 0)
  if (!Number.isSafeInteger(amount)) throw payoutError('The available earnings total is invalid. Contact support.', 409)
  return { amount, orderAllocations }
}

function requireRequestId(value) {
  const id = String(value || '')
  if (!/^PR-[a-f0-9]{64}$/.test(id)) throw payoutError('A valid payout request ID is required.', 400)
  return id
}

function payoutAllocations(allocations, maximum = 500000) {
  let remaining = maximum
  const selected = []
  for (const allocation of allocations) {
    if (remaining <= 0) break
    const amount = Math.min(allocation.amount, remaining)
    if (amount > 0) selected.push({ orderId: allocation.orderId, amount })
    remaining -= amount
  }
  return selected
}

async function clearRequestReservations(transaction, db, request, requestId) {
  const orderRefs = (request.orderAllocations || []).map((allocation) => db.collection('serviceRequests').doc(allocation.orderId))
  const workerLock = db.collection('payoutRequestLocks').doc(request.uid)
  const serviceLock = db.collection('payoutServiceLocks').doc('active')
  const [orders, workerLockSnapshot, serviceLockSnapshot] = await Promise.all([
    Promise.all(orderRefs.map((ref) => transaction.get(ref))),
    transaction.get(workerLock),
    transaction.get(serviceLock),
  ])
  for (let index = 0; index < orderRefs.length; index += 1) {
    if (orders[index].exists && orders[index].data().payoutRequestId === requestId) {
      transaction.update(orderRefs[index], { payoutRequestId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    }
  }
  if (workerLockSnapshot.data()?.activeRequestId === requestId) transaction.delete(workerLock)
  if (serviceLockSnapshot.data()?.activeRequestId === requestId) transaction.delete(serviceLock)
}

async function startPayoutAttempt(db, requestId, adminUid) {
  const payoutConfig = getFapshiPayoutConfig()
  if (payoutConfig.mode !== 'live') {
    throw payoutError('Sandbox payouts cannot settle live CareNest earnings. Use the sandbox payout smoke test instead.', 409)
  }
  const requestRef = db.collection('payoutRequests').doc(requestId)
  const serviceLockRef = db.collection('payoutServiceLocks').doc('active')
  let payoutRequest
  await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef)
    if (!requestSnapshot.exists) throw payoutError('Payout request not found.', 404)
    const current = requestSnapshot.data()
    if (current.status !== 'requested') throw payoutError('This payout request is not ready to execute.', 409)
    const lockSnapshot = await transaction.get(serviceLockRef)
    if (lockSnapshot.exists) throw payoutError('Another payout is being processed or reconciled. Resolve it first.', 409)
    const allocations = current.orderAllocations || []
    const orderRefs = allocations.map((item) => db.collection('serviceRequests').doc(item.orderId))
    const orderSnapshots = await Promise.all(orderRefs.map((ref) => transaction.get(ref)))
    const party = current.role === 'provider' ? 'provider' : 'rider'
    for (let index = 0; index < allocations.length; index += 1) {
      const orderSnapshot = orderSnapshots[index]
      const allocation = allocations[index]
      if (!orderSnapshot.exists || orderSnapshot.data().payoutRequestId !== requestId) {
        throw payoutError('A payout reservation is missing. Refresh the payout queue.', 409)
      }
      const order = orderSnapshot.data()
      const finance = orderFinance(order)
      const due = party === 'provider' ? finance.providerDue : finance.riderDue
      if (!eligibleForPayout(order) || order.paymentEnvironment !== 'live' || !Number.isSafeInteger(due) || due < allocation.amount) {
        throw payoutError('An allocated order is no longer eligible. Refresh the payout queue.', 409)
      }
    }
    const amount = allocations.reduce((sum, item) => sum + item.amount, 0)
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 500000) {
      throw payoutError('Fapshi payouts must be between 100 and 500,000 XAF.', 409)
    }
    payoutRequest = { ...current, amount, externalId: requestId }
    transaction.update(requestRef, {
      status: 'submitting',
      externalId: requestId,
      submittedBy: adminUid,
      payoutEnvironment: payoutConfig.mode,
      executionStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.create(serviceLockRef, { activeRequestId: requestId, startedAt: FieldValue.serverTimestamp() })
  })
  return payoutRequest
}

async function getMatchingPayouts(request, requestId) {
  const { response, result } = await fapshiPayoutRequest('/transaction/' + encodeURIComponent(request.providerUserId))
  if (!response.ok || !Array.isArray(result)) throw payoutError('Unable to reconcile this payout with Fapshi. The request remains locked.', 503)
  return result.filter((item) => item.externalId === requestId
    && item.userId === request.providerUserId
    && item.transType === 'Payout'
    && Number(item.amount) === request.amount)
}

async function resetForNoTransfer(db, requestId, note) {
  const ref = db.collection('payoutRequests').doc(requestId)
  const serviceLockRef = db.collection('payoutServiceLocks').doc('active')
  await db.runTransaction(async (transaction) => {
    const [requestSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(ref), transaction.get(serviceLockRef),
    ])
    if (!requestSnapshot.exists) throw payoutError('Payout request not found.', 404)
    if (requestSnapshot.data().status !== 'submitting') return
    transaction.update(ref, { status: 'requested', executionNote: note, updatedAt: FieldValue.serverTimestamp() })
    if (lockSnapshot.data()?.activeRequestId === requestId) transaction.delete(serviceLockRef)
  })
}

async function executePayout(db, requestId, adminUid) {
  const payoutRequest = await startPayoutAttempt(db, requestId, adminUid)
  try {
    const existing = await getMatchingPayouts(payoutRequest, requestId)
    if (existing.length > 1) {
      await recordPayoutAttemptState(db, requestId, 'unknown', { executionNote: 'Multiple Fapshi transactions match this payout.' })
      throw payoutError('Multiple Fapshi transactions match this request. It remains locked for investigation.', 409)
    }
    if (existing.length === 1) {
      const transactionId = String(existing[0].transId || existing[0].transactionId || '')
      await recordPayoutAttemptState(db, requestId, 'submitted', { transactionId })
      return reconcilePayout(db, requestId, 'admin-reconciliation')
    }

    const { response: balanceResponse, result: balance } = await fapshiPayoutRequest('/balance')
    if (!balanceResponse.ok || !Number.isSafeInteger(Number(balance.balance))) {
      throw payoutError('Could not confirm the payout service balance. The request remains locked for reconciliation.', 503)
    }
    if (Number(balance.balance) < payoutRequest.amount) {
      await resetForNoTransfer(db, requestId, 'Payout service balance is insufficient; no payout was sent.')
      throw payoutError('The Fapshi payout service does not have enough balance. Fund it and try again.', 409)
    }

    const { response, result } = await fapshiPayoutRequest('/payout', {
      method: 'POST',
      body: {
        amount: payoutRequest.amount,
        phone: payoutRequest.recipientPhone,
        medium: payoutRequest.medium,
        name: payoutRequest.recipientName,
        email: payoutRequest.recipientEmail,
        userId: payoutRequest.providerUserId,
        externalId: requestId,
        message: 'CareNest provider or rider earnings payout',
      },
    })
    if (!response.ok) {
      const matches = await getMatchingPayouts(payoutRequest, requestId)
      if (matches.length === 1) {
        const transactionId = String(matches[0].transId || matches[0].transactionId || '')
        await recordPayoutAttemptState(db, requestId, 'submitted', { transactionId })
        return reconcilePayout(db, requestId, 'admin-reconciliation')
      }
      if (matches.length === 0) {
        await resetForNoTransfer(db, requestId, 'Fapshi rejected the payout and reconciliation found no transaction.')
        throw payoutError('Fapshi did not accept the payout request. No transfer was recorded.', 502)
      }
      await recordPayoutAttemptState(db, requestId, 'unknown', { executionNote: 'Payout response was ambiguous and multiple transactions matched.' })
      throw payoutError('Payout outcome is ambiguous. It remains locked for investigation.', 503)
    }
    const transactionId = String(result.transId || result.transactionId || '')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
      await recordPayoutAttemptState(db, requestId, 'unknown', { executionNote: 'Fapshi accepted the payout but returned an invalid transaction reference.' })
      throw payoutError('Fapshi accepted the request without a usable transaction ID. It remains locked for reconciliation.', 503)
    }
    await recordPayoutAttemptState(db, requestId, 'submitted', { transactionId })
    return reconcilePayout(db, requestId, 'admin-poll')
  } catch (error) {
    const snapshot = await db.collection('payoutRequests').doc(requestId).get()
    if (snapshot.data()?.status === 'submitting') {
      await recordPayoutAttemptState(db, requestId, 'unknown', { executionNote: 'Payout outcome could not be confirmed. Reconcile before any retry.' })
    }
    if (!error.statusCode) throw payoutError('Payout outcome could not be confirmed. It remains locked for reconciliation.', 503)
    throw error
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })

  try {
    const user = await requireAuthenticatedUser(req)
    const db = getAdminDb()
    const body = req.body || {}

    if (body.action === 'adminList') {
      await requireAdmin(db, user)
      const statuses = ['requested', 'submitting', 'submitted', 'unknown']
      const snapshots = await Promise.all(statuses.map((status) => db.collection('payoutRequests')
        .where('status', '==', status).limit(100).get()))
      const requests = snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => requestView(doc.data(), doc.id, true)))
      requests.sort((first, second) => (second.requestedAt?.toMillis?.() || 0) - (first.requestedAt?.toMillis?.() || 0))
      return send(res, 200, { requests: requests.slice(0, 100) })
    }

    if (body.action === 'close') {
      await requireAdmin(db, user)
      const id = requireRequestId(body.requestId)
      const note = String(body.note || '').trim().slice(0, 500)
      if (note.length < 8) throw payoutError('Add a short note explaining the review outcome.', 400)
      const requestRef = db.collection('payoutRequests').doc(id)
      let closedRequest
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(requestRef)
        if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
        const current = snapshot.data()
        if (current.status !== 'requested') throw payoutError('This payout request is already closed.', 409)
        await clearRequestReservations(transaction, db, current, id)
        transaction.update(requestRef, {
          status: 'rejected',
          closedAt: FieldValue.serverTimestamp(),
          closedBy: user.uid,
          closeNote: note,
        })
        closedRequest = { ...current, status: 'rejected', closedBy: user.uid, closeNote: note }
      })
      return send(res, 200, { request: requestView(closedRequest, id, true) })
    }

    if (body.action === 'cancel') {
      const id = requireRequestId(body.requestId)
      const requestRef = db.collection('payoutRequests').doc(id)
      let cancelledRequest
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(requestRef)
        if (!snapshot.exists) throw payoutError('Payout request not found.', 404)
        const current = snapshot.data()
        if (current.uid !== user.uid) throw payoutError("You cannot cancel another user's payout request.", 403)
        if (current.status !== 'requested') throw payoutError('This payout request is already closed.', 409)
        await clearRequestReservations(transaction, db, current, id)
        transaction.update(requestRef, { status: 'cancelled', closedAt: FieldValue.serverTimestamp() })
        cancelledRequest = { ...current, status: 'cancelled' }
      })
      return send(res, 200, { request: requestView(cancelledRequest, id) })
    }

    if (body.action === 'listMine') {
      const snapshot = await db.collection('payoutRequests').where('uid', '==', user.uid)
        .limit(25).get()
      const requests = snapshot.docs.map((doc) => requestView(doc.data(), doc.id))
      requests.sort((first, second) => (second.requestedAt?.toMillis?.() || 0) - (first.requestedAt?.toMillis?.() || 0))
      return send(res, 200, { requests })
    }

    if (body.action === 'serviceBalance') {
      await requireAdmin(db, user)
      const { response, result, config } = await fapshiPayoutRequest('/balance', { allowUnapprovedLive: true })
      if (!response.ok || !Number.isSafeInteger(Number(result.balance))) throw payoutError('Unable to read the Fapshi payout service balance.', 503)
      return send(res, 200, { balance: Number(result.balance), currency: result.currency || 'XAF', environment: config.mode })
    }

    if (body.action === 'execute') {
      await requireAdmin(db, user)
      getFapshiPayoutConfig()
      const id = requireRequestId(body.requestId)
      const payout = await executePayout(db, id, user.uid)
      return send(res, payout.status === 'paid' ? 200 : 202, { payout })
    }

    if (body.action === 'verify') {
      await requireAdmin(db, user)
      const id = requireRequestId(body.requestId)
      const payout = await reconcilePayout(db, id)
      return send(res, ['paid', 'failed'].includes(payout.status) ? 200 : 202, { payout })
    }

    if (!['balance', 'request'].includes(body.action)) throw payoutError('Choose a supported payout action.', 400)
    const worker = await requireVerifiedWorker(db, user)
    const { role, recipientPhone } = worker
    let id = ''
    if (body.action === 'request') {
      const idempotencyKey = String(body.idempotencyKey || '')
      if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
        throw payoutError('Provide a valid idempotency key for this payout request.', 400)
      }
      id = 'PR-' + hash(user.uid + '\0' + idempotencyKey)
      const existing = await db.collection('payoutRequests').doc(id).get()
      if (existing.exists) {
        if (existing.data().uid !== user.uid) throw payoutError('Payout request identity mismatch.', 409)
        return send(res, 200, { request: requestView(existing.data(), id) })
      }
    }
    const earnings = await eligibleEarnings(db, user.uid, role)
    if (body.action === 'balance') {
      return send(res, 200, {
        role,
        amount: earnings.amount,
        currency: 'XAF',
        eligibleOrderCount: earnings.orderAllocations.length,
        recipientPhone: maskPhone(recipientPhone),
      })
    }
    if (earnings.amount < 100) throw payoutError('At least 100 XAF of eligible earnings is required to request a payout.', 409)

    const requestRef = db.collection('payoutRequests').doc(id)
    const lockRef = db.collection('payoutRequestLocks').doc(user.uid)
    const allocations = payoutAllocations(earnings.orderAllocations)
    const amount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    const orderRefs = allocations.map((allocation) => db.collection('serviceRequests').doc(allocation.orderId))
    let payoutRequest
    let created = false
    await db.runTransaction(async (transaction) => {
      const [existing, lock, orderSnapshots] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(lockRef),
        Promise.all(orderRefs.map((ref) => transaction.get(ref))),
      ])
      if (existing.exists) {
        payoutRequest = existing.data()
        return
      }
      if (lock.exists) {
        const activeRef = db.collection('payoutRequests').doc(lock.data().activeRequestId)
        const active = await transaction.get(activeRef)
        if (active.exists && !['paid', 'failed', 'cancelled', 'rejected'].includes(active.data().status)) {
          throw payoutError('You already have a payout request awaiting review.', 409)
        }
      }
      for (let index = 0; index < allocations.length; index += 1) {
        const orderSnapshot = orderSnapshots[index]
        const allocation = allocations[index]
        if (!orderSnapshot.exists || orderSnapshot.data().payoutRequestId) {
          throw payoutError('Some earnings are already reserved or have changed. Refresh your balance.', 409)
        }
        const order = orderSnapshot.data()
        const finance = orderFinance(order)
        const due = role === 'provider' ? finance.providerDue : finance.riderDue
        if (!eligibleForPayout(order) || order.paymentEnvironment !== 'live' || !Number.isSafeInteger(due) || due < allocation.amount) {
          throw payoutError('Some earnings are no longer eligible. Refresh your balance.', 409)
        }
      }
      if (amount < 100 || amount > 500000) throw payoutError('Fapshi payouts must be between 100 and 500,000 XAF.', 409)
      payoutRequest = {
        uid: user.uid,
        role,
        status: 'requested',
        amount,
        currency: 'XAF',
        eligibleOrderCount: allocations.length,
        orderAllocations: allocations,
        recipientPhone,
        recipientName: worker.recipientName,
        recipientEmail: worker.recipientEmail,
        medium: worker.medium,
        providerUserId: worker.providerUserId,
        requestedAt: FieldValue.serverTimestamp(),
        calculationVersion: 'finance-v1',
      }
      transaction.create(requestRef, payoutRequest)
      transaction.set(lockRef, { activeRequestId: id, updatedAt: FieldValue.serverTimestamp() })
      allocations.forEach((_allocation, index) => transaction.update(orderRefs[index], {
        payoutRequestId: id,
        updatedAt: FieldValue.serverTimestamp(),
      }))
      created = true
    })
    return send(res, created ? 201 : 200, { request: requestView(payoutRequest, id) })
  } catch (error) {
    return send(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Unable to process the payout request.',
    })
  }
}