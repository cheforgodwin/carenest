import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/firebaseConfig'
import { postJson } from '../../utils/networkUtils'
import { csvCell, financeTotals, orderFinance } from '../../utils/finance'
import './FinancePanel.css'

const amount = (value) => value === null || value === undefined ? 'Not confirmed' : Number(value).toLocaleString() + ' XAF'
const percent = (bps) => bps === null || bps === undefined ? 'Not set' : (bps / 100).toFixed(2).replace(/\.00$/, '') + '%'
const date = (value) => { const d = value?.toDate?.() || (value ? new Date(value) : null); return d && Number.isFinite(d.getTime()) ? d.toLocaleString() : 'Not recorded' }
const emptyPolicy = { provider: '80', deliveryProvider: '', deliveryRider: '', feeBearer: '' }
const emptyTransfer = { kind: 'provider_payout', amount: '', reference: '', method: 'Mobile Money', recipient: '', occurredAt: '', transferFee: '', note: '' }

export default function FinancePanel({ orders, alerts, permission, enableNotifications }) {
  const [entries, setEntries] = useState([])
  const [policy, setPolicy] = useState(null)
  const [draft, setDraft] = useState(emptyPolicy)
  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState('')
  const [transfer, setTransfer] = useState(emptyTransfer)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const stopEntries = onSnapshot(query(collection(db, 'financialEntries'), orderBy('recordedAt', 'desc')), (snapshot) => setEntries(snapshot.docs.map((item) => ({ entryId: item.id, ...item.data() }))), (e) => setError(e.message))
    const stopPolicy = onSnapshot(doc(db, 'financialSettings', 'current'), (snapshot) => {
      const current = snapshot.data() || null
      setPolicy(current)
      if (current) setDraft({ provider: String(current.providerBps / 100), deliveryProvider: String(current.deliveryProviderBps / 100), deliveryRider: String(current.deliveryRiderBps / 100), feeBearer: current.feeBearer })
    }, (e) => setError(e.message))
    return () => { stopEntries(); stopPolicy() }
  }, [])
  const filtered = useMemo(() => orders.filter((order) => {
    const env = order.paymentEnvironment || 'unknown'
    if (environment !== 'all' && env !== environment) return false
    if (status !== 'all' && order.paymentStatus !== status) return false
    const created = order.createdAt?.toDate?.() || order.createdAtDate
    const ms = created?.getTime?.()
    if (from && (!ms || ms < new Date(from + 'T00:00:00').getTime())) return false
    if (to && (!ms || ms >= new Date(to + 'T23:59:59.999').getTime())) return false
    return [order.id, order.paymentReference, order.customerName, order.providerName, order.riderName].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  }), [orders, environment, status, from, to, search])
  const totals = financeTotals(filtered.filter((order) => order.paymentEnvironment === (environment === 'sandbox' ? 'sandbox' : 'live')))
  const order = orders.find((item) => item.firestoreId === selected)
  const financial = order ? orderFinance(order) : null
  const shownEntries = entries.filter((entry) => selected ? entry.orderId === selected : filtered.some((item) => item.firestoreId === entry.orderId))
  async function act(payload) {
    setBusy(true); setMessage(''); setError('')
    try { const result = await postJson('/api/finance', payload); setMessage(result.message); return true }
    catch (e) { setError(e.message); return false }
    finally { setBusy(false) }
  }
  function exportCsv() {
    const rows = [['Order', 'Environment', 'Customer', 'Collection status', 'Reference', 'Collected XAF', 'Fapshi fee XAF', 'Fapshi effective %', 'Provider net allocation XAF', 'Rider net allocation XAF', 'CareNest net allocation XAF', 'Earnings recognized', 'Provider paid XAF', 'Rider paid XAF', 'Refunded XAF', 'Pricing version']]
    for (const item of filtered) {
      const f = orderFinance(item)
      rows.push([item.id, item.paymentEnvironment || 'unknown', item.customerName, item.paymentStatus, item.paymentReference, f.paid ? item.amount : 0, f.fee ?? 'unknown', item.paymentFinancials?.feePercent ?? 'unknown', f.provider ?? 'unknown', f.rider ?? 'unknown', f.platform ?? 'unknown', f.earned ? 'yes' : 'no', f.providerPaid, f.riderPaid, f.refund, item.financialSnapshot?.version || 'unconfigured'])
    }
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'carenest-finance.csv'; link.click(); URL.revokeObjectURL(url)
  }
  async function savePolicy(event) {
    event.preventDefault()
    if ([draft.provider, draft.deliveryProvider, draft.deliveryRider, draft.feeBearer].some((value) => value === '')) { setError('Confirm all shares and who pays the Fapshi fee.'); return }
    const toBps = (value) => Math.round(Number(value) * 100)
    await act({ action: 'savePolicy', policy: { providerBps: toBps(draft.provider), riderBps: 0, deliveryProviderBps: toBps(draft.deliveryProvider), deliveryRiderBps: toBps(draft.deliveryRider), feeBearer: draft.feeBearer } })
  }
  async function recordTransfer(event) {
    event.preventDefault()
    const saved = await act({ action: 'recordTransfer', orderId: selected, ...transfer, amount: Number(transfer.amount), transferFee: transfer.transferFee === '' ? null : Number(transfer.transferFee), occurredAt: new Date(transfer.occurredAt).toISOString() })
    if (saved) setTransfer(emptyTransfer)
  }
  const choose = (id) => { setSelected(id); setMessage(''); setError(''); setTransfer(emptyTransfer); setNote(''); if (id) window.setTimeout(() => document.getElementById('finance-order-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  return <div className="finance-view">
    <section className="dashboard-panel">
      <div className="dashboard-panel-header"><div><h2>Transactions and earnings</h2><p>Collections, fees, earnings allocations and recorded transfers. All amounts are in XAF.</p></div><button className="dashboard-action-button" type="button" onClick={exportCsv}>Export transactions</button></div>
      <div className="finance-filters">
        <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order, transaction or person" /></label>
        <label>Environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)}><option value="live">Live money</option><option value="sandbox">Sandbox tests</option><option value="unknown">Historical / unknown</option><option value="all">All records</option></select></label>
        <label>Payment<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{['Pending', 'Submitted', 'Paid', 'Failed', 'Refunded'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <p className="finance-note">Totals below cover {environment === 'sandbox' ? 'sandbox tests only, not real money' : 'verified live collections only'}. Unknown-environment records are excluded. Earnings are recognized only after customer-confirmed completion, without a hold or refund. CareNest earnings shown are after the collection fee and before other business or transfer costs.</p>
      <div className="finance-summary">{[['Customer collections', totals.collected], ['Fapshi fees known', totals.fees], ['CareNest earned', totals.platform], ['Providers earned', totals.provider], ['Riders earned', totals.rider], ['Provider transfers recorded', totals.providerPaid], ['Rider transfers recorded', totals.riderPaid], ['Refunds recorded', totals.refunds]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{amount(value)}</strong></article>)}</div>
      <p>{totals.unknownFees} collection(s) with unknown fees; {totals.unallocated} with no confirmed split; {totals.pendingEarnings} not included in earned totals.</p>
      <div className="finance-table-wrap"><table className="dashboard-table"><thead><tr><th>Order / reference</th><th>Payment</th><th>Amount</th><th>Fapshi fee</th><th>Provider allocation</th><th>Rider allocation</th><th>CareNest allocation</th><th>Review</th></tr></thead><tbody>{filtered.map((item) => {
        const f = orderFinance(item)
        return <tr key={item.firestoreId}><td>{item.id}<small>{item.paymentReference || 'No provider reference'}<br />{item.paymentEnvironment || 'Unknown environment'}</small></td><td>{item.paymentStatus}<small>{f.earned ? 'Earned after completion' : f.held ? 'Held / review required' : 'Not yet earned'}</small></td><td>{amount(item.amount)}</td><td>{amount(f.fee)}<small>{item.paymentFinancials?.feePercent == null ? 'Rate not confirmed' : item.paymentFinancials.feePercent.toFixed(2) + '%'}</small></td><td>{amount(f.provider)}<small>{percent(item.financialSnapshot?.providerBps)}</small></td><td>{amount(f.rider)}<small>{percent(item.financialSnapshot?.riderBps)}</small></td><td>{amount(f.platform)}<small>{percent(item.financialSnapshot?.platformBps)} before fee</small></td><td><button className="table-action" type="button" onClick={() => choose(item.firestoreId)}>View details</button></td></tr>
      })}</tbody></table></div>{!filtered.length && <p className="dashboard-empty">No matching transactions. Choose All records to include older orders whose payment environment was not recorded.</p>}
    </section>
    {error && <p role="alert" className="dashboard-error">{error}</p>}{message && <p role="status" className="dashboard-success">{message}</p>}
    {order && <section id="finance-order-detail" className="dashboard-panel finance-detail"><div className="dashboard-panel-header"><h2>{order.id}: money details</h2><button type="button" onClick={() => choose('')}>Close details</button></div>
      <p>Customer: {order.customerName || order.customerUid} | Provider: {order.providerName || 'Unassigned'} | Rider: {order.riderName || 'Unassigned'}</p>
      <div className="finance-summary">{[['Provider outstanding', financial.providerDue], ['Rider outstanding', financial.riderDue], ['Refunded', financial.refund], ['Fapshi net collection', order.paymentFinancials?.revenue]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{amount(value)}</strong></article>)}</div>
      <p>Pricing version: {order.financialSnapshot?.version || 'Not recorded'}. Fee charged to: {order.financialSnapshot?.feeBearer === 'platform' ? 'CareNest' : order.financialSnapshot?.feeBearer === 'proportional' ? 'All shares proportionally' : 'Not confirmed'}.</p>
      <button className="table-action" type="button" disabled={busy || !order.paymentReference} onClick={() => act({ action: 'verifyPayment', orderId: selected })}>Verify collection and Fapshi fee</button>
      {order.financialSnapshot?.state !== 'confirmed' && <form className="finance-form" onSubmit={(e) => { e.preventDefault(); act({ action: 'allocate', orderId: selected, note }) }}><h3>Record missing historical allocation</h3><p>This permanently applies the current approved split to this order. Confirm the original agreement first.</p><label>Reason<input minLength="8" maxLength="500" required value={note} onChange={(e) => setNote(e.target.value)} /></label><button disabled={busy || !policy}>Record allocation</button></form>}
      <form className="finance-form" onSubmit={recordTransfer}><h3>Record a transfer already sent</h3><p>Use the actual payment receipt. Saving this form does not send money. Unknown-environment and sandbox orders cannot record real transfers.</p><div className="finance-filters">
        <label>Type<select value={transfer.kind} onChange={(e) => setTransfer({ ...transfer, kind: e.target.value })}><option value="provider_payout">Provider payment</option><option value="rider_payout">Rider payment</option><option value="refund">Customer refund</option></select></label>
        {['amount', 'reference', 'recipient', 'occurredAt', 'transferFee', 'note'].map((key) => <label key={key}>{({ amount: 'Amount sent (XAF)', reference: 'Transaction reference', recipient: 'Recipient phone / account', occurredAt: 'Transfer date', transferFee: 'Transfer fee (leave blank if unknown)', note: 'Note' })[key]}<input type={['amount', 'transferFee'].includes(key) ? 'number' : key === 'occurredAt' ? 'datetime-local' : 'text'} min={key === 'amount' ? '1' : '0'} step="1" maxLength="500" required={!['note', 'transferFee'].includes(key)} value={transfer[key]} onChange={(e) => setTransfer({ ...transfer, [key]: e.target.value })} /></label>)}
        <label>Method<select value={transfer.method} onChange={(e) => setTransfer({ ...transfer, method: e.target.value })}><option>Mobile Money</option><option>Bank transfer</option><option>Fapshi</option></select></label>
      </div><button disabled={busy}>Record transfer evidence</button></form>
    </section>}
    <section className="dashboard-panel"><h2>Transaction history {selected ? 'for selected order' : ''}</h2><p>Payment attempts and status events are not additional money received. Transfer entries are records of payments attested by an admin.</p><div className="finance-table-wrap"><table className="dashboard-table"><thead><tr><th>Recorded</th><th>Order</th><th>Event</th><th>Amount</th><th>Reference / status</th><th>Evidence</th></tr></thead><tbody>{shownEntries.map((entry) => <tr key={entry.entryId}><td>{date(entry.recordedAt)}</td><td>{entry.orderLabel}</td><td>{entry.kind.replaceAll('_', ' ')}</td><td>{amount(entry.amount)}</td><td>{entry.reference}<small>{entry.status}</small></td><td>{entry.recipient || entry.source || entry.recordedBy}<small>{entry.method || ''} {entry.occurredAtMs ? date(entry.occurredAtMs) : ''}<br />{entry.note || ''}</small>{entry.kind.endsWith('payout') || entry.kind === 'refund' ? <small>Transfer fee: {amount(entry.transferFee)}</small> : null}</td></tr>)}</tbody></table></div>{!shownEntries.length && <p>No recorded events for this selection. Older orders remain in the order list; historical transfer evidence is not invented.</p>}</section>
    <section className="dashboard-panel" id="finance-attention"><div className="dashboard-panel-header"><h2>Needs your attention ({alerts.length})</h2><button type="button" disabled={permission === 'unsupported'} onClick={enableNotifications}>{permission === 'granted' ? 'Enable alerts on this browser' : 'Enable browser notifications'}</button></div><p>In-app alerts update while you are signed in. Browser notifications require permission and an open admin dashboard; email and background push are not connected.</p>{alerts.map((alert) => <article className="finance-alert" key={alert.id}><div><strong>{alert.label}</strong><p>{alert.message}</p></div><button type="button" onClick={() => choose(alert.orderId)}>Review</button></article>)}{!alerts.length && <p>No transaction issues need attention.</p>}</section>
    <section className="dashboard-panel"><h2>Pricing percentages</h2><p>{policy ? 'Current policy: ' + policy.version : 'No confirmed policy yet. 80% / 20% is the previous proposal; confirm all settings before applying it.'} Changes apply to future payment requests. Existing confirmed allocations remain unchanged.</p>
      <form className="finance-form" onSubmit={savePolicy}><div className="finance-filters">{[['provider', 'Provider share: orders without a rider'], ['deliveryProvider', 'Provider share: delivery orders'], ['deliveryRider', 'Rider share: delivery orders']].map(([key, label]) => <label key={key}>{label} (%)<input type="number" min="0" max="100" step="0.01" required value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        <label>Who pays Fapshi's collection fee?<select required value={draft.feeBearer} onChange={(e) => setDraft({ ...draft, feeBearer: e.target.value })}><option value="">Choose</option><option value="platform">Deduct from CareNest share</option><option value="proportional">Deduct proportionally from all shares</option></select></label>
      </div><p>CareNest share without rider: {draft.provider === '' ? 'Not set' : 100 - Number(draft.provider) + '%'}. Delivery CareNest share: {draft.deliveryProvider === '' || draft.deliveryRider === '' ? 'Not set' : 100 - Number(draft.deliveryProvider) - Number(draft.deliveryRider) + '%'}.</p><p>Fapshi sets its own fees. Actual fees and effective percentages are taken from verified collections; missing fees stay unconfirmed. <a href="https://www.fapshi.com/en/pricing" target="_blank" rel="noreferrer">Fapshi pricing</a></p><button disabled={busy}>Confirm and save pricing</button></form>
    </section>
  </div>
}
