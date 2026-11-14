import { useEffect, useState } from 'react'
import { postJson } from '../../utils/networkUtils'
import './FinancePanel.css'

const amount = (value) => Number(value || 0).toLocaleString() + ' XAF'
const date = (value) => {
  const parsed = value?.toDate?.() || (value ? new Date(value) : null)
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'Not recorded'
}

async function loadPayoutData(mode) {
  if (mode === 'admin') {
    const [balance, queue] = await Promise.all([
      postJson('/api/payouts', { action: 'serviceBalance' }),
      postJson('/api/payouts', { action: 'adminList' }),
    ])
    return { balance, requests: queue.requests || [] }
  }
  const [balance, history] = await Promise.all([
    postJson('/api/payouts', { action: 'balance' }),
    postJson('/api/payouts', { action: 'listMine' }),
  ])
  return { balance, requests: history.requests || [] }
}

function formatError(error) {
  return error?.message || 'Payout information could not be loaded.'
}

export default function PayoutPanel({ mode = 'worker' }) {
  const isAdmin = mode === 'admin'
  const [balance, setBalance] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    loadPayoutData(mode).then((data) => {
      if (!active) return
      setBalance(data.balance)
      setRequests(data.requests)
    }).catch((loadError) => {
      if (active) setError(formatError(loadError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [mode])

  async function refresh() {
    setError('')
    try {
      const data = await loadPayoutData(mode)
      setBalance(data.balance)
      setRequests(data.requests)
    } catch (loadError) {
      setError(formatError(loadError))
    }
  }

  async function perform(action, requestId, note = '') {
    if (action === 'execute' && !window.confirm('Send this payout using the configured Fapshi payout service? Verify the recipient and amount first.')) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await postJson('/api/payouts', {
        action,
        ...(requestId ? { requestId } : {}),
        ...(note ? { note } : {}),
        ...(action === 'request' ? { idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } : {}),
      })
      setMessage(action === 'request' ? 'Payout request submitted for review.'
        : action === 'cancel' ? 'Payout request cancelled.'
          : action === 'execute' ? result.payout?.status === 'paid' ? 'Payout confirmed by Fapshi.' : 'Payout submitted; awaiting verified status.'
            : action === 'verify' ? `Payout status: ${result.payout?.status || 'updated'}.`
              : 'Payout request updated.')
      await refresh()
    } catch (actionError) {
      setError(formatError(actionError))
    } finally {
      setBusy(false)
    }
  }

  return <section className="dashboard-panel payout-panel" aria-labelledby={isAdmin ? 'admin-payout-heading' : 'worker-payout-heading'}>
    <div className="dashboard-panel-header">
      <div>
        <h2 id={isAdmin ? 'admin-payout-heading' : 'worker-payout-heading'}>{isAdmin ? 'Fapshi payouts' : 'Your payouts'}</h2>
        <p>{isAdmin ? 'Review reserved earnings, check the payout-service balance, and verify any uncertain transfer.' : 'Only customer-confirmed, verified live earnings are available to request.'}</p>
      </div>
      <button className="table-action secondary" type="button" disabled={busy || loading} onClick={refresh}>Refresh</button>
    </div>

    {error && <p className="dashboard-error" role="alert">{error}</p>}
    {message && <p className="dashboard-success" role="status">{message}</p>}
    {loading ? <p className="dashboard-empty" role="status">Loading payout information...</p> : <>
      {isAdmin ? <div className="payout-service-balance">
        <span>Payout service balance</span>
        <strong>{balance ? amount(balance.balance) : 'Unavailable'}</strong>
        {balance && <small>{balance.environment === 'sandbox' ? 'Sandbox, no real funds' : 'Live service'} · {balance.currency}</small>}
      </div> : <div className="payout-worker-balance">
        <div><span>Eligible earnings</span><strong>{balance ? amount(balance.amount) : 'Unavailable'}</strong></div>
        <div><span>Eligible jobs</span><strong>{balance?.eligibleOrderCount ?? '—'}</strong></div>
        <div><span>Verified destination</span><strong>{balance?.recipientPhone || 'Not verified'}</strong></div>
        <button className="dashboard-action-button" type="button" disabled={busy || !balance || balance.amount < 100 || requests.some((request) => ['requested', 'submitting', 'submitted', 'unknown'].includes(request.status))} onClick={() => perform('request')}>
          {busy ? 'Working...' : 'Request payout'}
        </button>
      </div>}

      <div className="finance-table-wrap">
        <table className="dashboard-table">
          <thead><tr>{isAdmin && <th>Worker</th>}<th>Requested</th><th>Amount</th><th>Status</th>{isAdmin && <><th>Verified destination</th><th>Orders</th></>}<th>Action</th></tr></thead>
          <tbody>{requests.map((request) => <tr key={request.requestId}>
            {isAdmin && <td data-label="Worker">{request.role}<small>{request.uid}</small></td>}
            <td data-label="Requested">{date(request.requestedAt)}<small>{request.requestId}</small></td>
            <td data-label="Amount">{amount(request.amount)}<small>{request.eligibleOrderCount} eligible order(s)</small></td>
            <td data-label="Status"><span className={`status-chip ${String(request.status).replaceAll('_', '-')}`}>{request.status}</span>{request.providerStatus && <small>Fapshi: {request.providerStatus}</small>}</td>
            {isAdmin && <><td data-label="Verified destination">{request.recipientPhone}<small>{request.medium}</small></td><td data-label="Orders">{(request.orderAllocations || []).map((allocation) => <small key={allocation.orderId}>{allocation.orderId}: {amount(allocation.amount)}</small>)}</td></>}
            <td data-label="Action"><div className="table-action-row">
              {isAdmin && request.status === 'requested' && <button className="table-action" type="button" disabled={busy} onClick={() => perform('execute', request.requestId)}>Execute</button>}
              {isAdmin && ['submitting', 'submitted', 'unknown'].includes(request.status) && <button className="table-action" type="button" disabled={busy} onClick={() => perform('verify', request.requestId)}>Verify</button>}
              {isAdmin && request.status === 'requested' && <button className="table-action secondary" type="button" disabled={busy} onClick={() => perform('close', request.requestId, 'Rejected after admin review.')}>Reject</button>}
              {!isAdmin && request.status === 'requested' && <button className="table-action secondary" type="button" disabled={busy} onClick={() => perform('cancel', request.requestId)}>Cancel</button>}
              {!['requested', 'submitting', 'submitted', 'unknown'].includes(request.status) && <span className="dashboard-muted">No action</span>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!requests.length && <p className="dashboard-empty">{isAdmin ? 'No payout requests need review.' : 'No payout requests yet.'}</p>}
      <p className="finance-note">{isAdmin
        ? 'Execution uses the configured payout service. An uncertain result stays locked until Fapshi confirms it; never submit a duplicate transfer manually.'
        : 'Requests reserve these earnings while they are reviewed. Payouts are sent only after admin review.'}</p>
    </>}
  </section>
}
