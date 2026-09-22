export const money = (value) => Number.isSafeInteger(value) && value >= 0
export const confirmedCollection = (order) => ['Paid', 'Refunded'].includes(order.paymentStatus)
  && Boolean(order.paymentVerifiedAt) && ['fapshi-webhook', 'fapshi-poll'].includes(order.paymentVerifiedBy)

export function validatePolicy(input) {
  const fields = ['providerBps', 'riderBps', 'deliveryProviderBps', 'deliveryRiderBps']
  for (const field of fields) if (!money(input[field]) || input[field] > 10000) throw new Error('Enter valid percentages between 0 and 100.')
  if (input.riderBps !== 0 || input.providerBps + input.riderBps > 10000 || input.deliveryProviderBps + input.deliveryRiderBps > 10000) throw new Error('Shares cannot exceed 100%. Non-delivery orders have no rider share.')
  if (!['platform', 'proportional'].includes(input.feeBearer)) throw new Error('Choose who pays the Fapshi fee.')
  return Object.fromEntries([...fields, 'feeBearer'].map((field) => [field, input[field]]))
}

export function financialSnapshot(order, policy) {
  if (!money(order.amount)) throw new Error('Invalid order amount.')
  if (!policy?.version) return { state: 'unconfigured', currency: 'XAF', amount: order.amount }
  const checked = validatePolicy(policy)
  const delivery = order.serviceType === 'delivery' || Boolean(order.riderUid)
  const providerBps = delivery ? checked.deliveryProviderBps : checked.providerBps
  const riderBps = delivery ? checked.deliveryRiderBps : 0
  return { state: 'confirmed', currency: 'XAF', amount: order.amount, version: policy.version, providerBps, riderBps, platformBps: 10000 - providerBps - riderBps, feeBearer: checked.feeBearer }
}

export function providerFee(payment) {
  const revenue = typeof payment.revenue === 'number' ? payment.revenue : /^\d+$/.test(String(payment.revenue ?? '')) ? Number(payment.revenue) : null
  const amount = Number(payment.amount)
  if (!money(amount) || !money(revenue) || revenue > amount) return { amount: null, revenue: null, percent: null }
  return { amount: amount - revenue, revenue, percent: amount ? (amount - revenue) * 100 / amount : null }
}

export function splitMoney(snapshot, fee = null) {
  if (snapshot?.state !== 'confirmed') return { provider: null, rider: null, platform: null, providerGross: null, riderGross: null, platformGross: null }
  const { amount, providerBps, riderBps, feeBearer } = snapshot
  const providerGross = Math.floor(amount * providerBps / 10000)
  const riderGross = Math.floor(amount * riderBps / 10000)
  const platformGross = amount - providerGross - riderGross
  if (!money(fee)) return { providerGross, riderGross, platformGross, provider: feeBearer === 'platform' ? providerGross : null, rider: riderGross === 0 ? 0 : feeBearer === 'platform' ? riderGross : null, platform: null }
  const base = feeBearer === 'proportional' ? amount - fee : amount
  const provider = Math.floor(base * providerBps / 10000)
  const rider = Math.floor(base * riderBps / 10000)
  return { providerGross, riderGross, platformGross, provider, rider, platform: amount - fee - provider - rider }
}

export function orderFinance(order) {
  const paid = confirmedCollection(order)
  const fee = money(order.paymentFinancials?.fapshiFee) ? order.paymentFinancials.fapshiFee : null
  const split = splitMoney(order.financialSnapshot, fee)
  const totals = order.financeTotals || {}
  const refund = money(totals.refund) ? totals.refund : 0
  const held = ['Complaint', 'Cancelled'].includes(order.status) || order.payoutStatus === 'Held' || order.refundStatus === 'Requested' || order.disputeStatus === 'Open' || refund > 0
  const completed = paid && order.status === 'Completed' && order.completionConfirmedBy === order.customerUid && Boolean(order.completionConfirmedAt)
  return { paid, fee, ...split, refund, held, completed, earned: completed && !held,
    providerPaid: totals.provider || 0, riderPaid: totals.rider || 0,
    providerDue: split.provider === null ? null : Math.max(0, split.provider - (totals.provider || 0)),
    riderDue: split.rider === null ? null : Math.max(0, split.rider - (totals.rider || 0)),
    legacyTransfer: ['Paid', 'Partial'].includes(order.payoutStatus) && !totals.provider,
  }
}

export function attentionItems(orders) {
  const items = []
  for (const order of orders) {
    const f = orderFinance(order)
    const add = (reason, message) => items.push({ id: order.firestoreId + ':' + reason + ':' + (order.paymentReference || order.paymentInitiationId || ''), orderId: order.firestoreId, label: order.id, reason, message })
    if (['Unknown', 'Starting'].includes(order.paymentInitiationState)) add('payment-unknown', 'Payment outcome needs checking before another charge.')
    if (order.paymentStatus === 'Failed' || order.paymentInitiationState === 'Failed') add('payment-failed', 'Payment failed or was refused. Review the saved order.')
    if (order.refundStatus === 'Requested') add('refund', 'Refund requested; settlement is on hold.')
    if (order.disputeStatus === 'Open' || order.status === 'Complaint') add('complaint', 'Customer complaint needs a decision.')
    if (f.paid && order.financialSnapshot?.state !== 'confirmed') add('allocation', 'The order has no confirmed earnings split.')
    if (f.paid && f.fee === null) add('fee', 'Fapshi fee is not yet verified.')
    if (f.legacyTransfer) add('legacy-transfer', 'Old payout status has no transfer record. Reconcile before paying.')
    if (f.earned && !f.legacyTransfer && ((f.providerDue || 0) > 0 || (f.riderDue || 0) > 0)) add('payout', 'Completed order has unpaid provider or rider earnings.')
    if (f.paid && f.platform !== null && f.platform < 0) add('negative-margin', 'Fapshi fee exceeds the CareNest share. Review pricing.')
  }
  return items
}

export function financeTotals(orders) {
  const total = { collected: 0, fees: 0, platform: 0, provider: 0, rider: 0, providerPaid: 0, riderPaid: 0, refunds: 0, unknownFees: 0, unallocated: 0, pendingEarnings: 0 }
  for (const order of orders) {
    const f = orderFinance(order)
    if (!f.paid) continue
    total.collected += order.amount
    total.refunds += f.refund
    total.providerPaid += f.providerPaid
    total.riderPaid += f.riderPaid
    if (f.fee === null) total.unknownFees++
    else total.fees += f.fee
    if (order.financialSnapshot?.state !== 'confirmed') total.unallocated++
    if (!f.earned || f.platform === null) { total.pendingEarnings++; continue }
    total.platform += f.platform
    total.provider += f.provider || 0
    total.rider += f.rider || 0
  }
  return total
}

export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}
