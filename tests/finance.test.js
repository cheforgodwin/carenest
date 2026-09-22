import { describe, it, expect } from 'vitest'
import { validatePolicy, financialSnapshot, providerFee, splitMoney, orderFinance, financeTotals, attentionItems, csvCell } from '../src/utils/finance.js'
const policy = { version: 'v1', providerBps: 8000, riderBps: 0, deliveryProviderBps: 6000, deliveryRiderBps: 2000, feeBearer: 'platform' }
const order = { firestoreId: 'a', amount: 10000, customerUid: 'c', paymentStatus: 'Paid', paymentVerifiedAt: 1, paymentVerifiedBy: 'fapshi-poll', status: 'Completed', completionConfirmedBy: 'c', completionConfirmedAt: 1, paymentFinancials: { fapshiFee: 100 }, financialSnapshot: financialSnapshot({ amount: 10000 }, policy) }
describe('financial accounting', () => {
  it('records actual collection fees without inventing a default', () => {
    expect(providerFee({ amount: 10000, revenue: '9900' })).toEqual({ amount: 100, revenue: 9900, percent: 1 })
    for (const revenue of [undefined, null, '', -1, 10001, 'invalid']) expect(providerFee({ amount: 10000, revenue }).amount).toBeNull()
  })
  it('preserves the approved split independently of later policy changes', () => {
    const snapshot = financialSnapshot({ amount: 10000, serviceType: 'delivery' }, policy)
    expect(snapshot).toMatchObject({ providerBps: 6000, riderBps: 2000, platformBps: 2000 })
    expect(splitMoney(snapshot, 100)).toMatchObject({ provider: 6000, rider: 2000, platform: 1900 })
    expect(financialSnapshot({ amount: 10000 }, null).state).toBe('unconfigured')
  })
  it('allocates integer francs without losing money to rounding', () => {
    for (const feeBearer of ['platform', 'proportional']) for (const amount of [101, 999, 10001]) {
      const f = splitMoney(financialSnapshot({ amount, serviceType: 'delivery' }, { ...policy, feeBearer }), 17)
      expect(f.provider + f.rider + f.platform + 17).toBe(amount)
    }
  })
  it('keeps unknown fees distinct from zero fees', () => {
    expect(splitMoney(order.financialSnapshot)).toMatchObject({ provider: 8000, platform: null })
    expect(splitMoney({ ...order.financialSnapshot, feeBearer: 'proportional' })).toMatchObject({ provider: null, platform: null })
    expect(splitMoney(order.financialSnapshot, 0).platform).toBe(2000)
  })
  it('requires verified payment, completion and no hold to recognize earnings', () => {
    expect(financeTotals([order])).toMatchObject({ collected: 10000, platform: 1900, provider: 8000 })
    for (const patch of [{ status: 'Pending' }, { payoutStatus: 'Held' }, { refundStatus: 'Requested' }, { completionConfirmedBy: 'admin' }, { paymentVerifiedBy: 'client' }]) expect(financeTotals([{ ...order, ...patch }]).platform).toBe(0)
    expect(orderFinance({ ...order, financeTotals: { provider: 3000 } }).providerDue).toBe(5000)
  })
  it('flags unresolved payments, missing fees, refunds and unpaid earnings', () => {
    const alerts = attentionItems([{ ...order, paymentFinancials: {}, refundStatus: 'Requested', paymentInitiationState: 'Unknown' }, order])
    expect(alerts.map((a) => a.reason)).toEqual(expect.arrayContaining(['fee', 'refund', 'payment-unknown', 'payout']))
  })
  it('rejects invalid pricing and guards exported spreadsheet formulas', () => {
    for (const patch of [{ providerBps: 10001 }, { deliveryRiderBps: 5000 }, { riderBps: 1 }, { feeBearer: '' }]) expect(() => validatePolicy({ ...policy, ...patch })).toThrow()
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
  })
})
