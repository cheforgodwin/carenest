import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiDownload } from 'react-icons/fi'
import {
  adminAssignServiceRequest,
  adminClearServiceRequestProvider,
  calculatePlatformFee,
  calculateProviderEarning,
  isPayoutReady,
  paymentStatuses,
  payoutStatuses,
  subscribeToAllOrders,
  subscribeToPaymentSmsReceipts,
  subscribeToUsers,
  updatePaymentStatus,
  updateProviderPayoutStatus,
  updateServiceRequestStatus,
} from '../../firebase/orderService'
import {
  approveProviderApplication,
  rejectProviderApplication,
  subscribeToProviderApplications,
  updateProviderVerification,
} from '../../firebase/providerApplicationService'
import { useAuth } from '../../auth/useAuth'
import DashboardShell from './DashboardShell'
import { useEffect } from 'react'

const statusOptions = ['Pending', 'Assigned', 'In Progress', 'Quality Check', 'Out for Delivery', 'Completed', 'Complaint', 'Cancelled']

function formatAmount(amount) {
  return `${Number(amount || 0).toLocaleString()} FCFA`
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  return value.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function normalizeStatus(status) {
  return String(status || 'Pending').toLowerCase().replace(/\s+/g, '-')
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function AdminDashboardPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const activeView = searchParams.get('view') || 'overview'
  const [orders, setOrders] = useState([])
  const [paymentReceipts, setPaymentReceipts] = useState([])
  const [users, setUsers] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerSelections, setProviderSelections] = useState({})

  useEffect(() => {
    const unsubOrders = subscribeToAllOrders(
      (nextOrders) => {
        setOrders(nextOrders)
        setLoading(false)
      },
      (nextError) => {
        setError(nextError.message)
        setLoading(false)
      },
    )
    const unsubUsers = subscribeToUsers(
      setUsers,
      (nextError) => setError(nextError.message),
    )
    const unsubApplications = subscribeToProviderApplications(
      setApplications,
      (nextError) => setError(nextError.message),
    )
    const unsubPaymentReceipts = subscribeToPaymentSmsReceipts(
      setPaymentReceipts,
      (nextError) => setError(nextError.message),
    )
    return () => {
      unsubOrders()
      unsubUsers()
      unsubApplications()
      unsubPaymentReceipts()
    }
  }, [])

  const todayKey = new Date().toDateString()
  const providers = users.filter((user) => user.accountType === 'provider')
  const customers = users.filter((user) => user.accountType === 'customer')
  const admins = users.filter((user) => user.accountType === 'admin')
  const completedOrders = orders.filter((order) => order.status === 'Completed')
  const openOrders = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const complaints = orders.filter((order) => order.status === 'Complaint')
  const readyPayoutOrders = orders.filter((order) => isPayoutReady(order) && order.payoutStatus !== 'Paid' && order.payoutStatus !== 'Held')
  const pendingApplications = applications.filter((application) => application.status === 'Pending')
  const reviewPaymentReceipts = paymentReceipts.filter((receipt) => receipt.matchStatus === 'needs_review')
  const revenue = completedOrders.reduce((total, order) => total + Number(order.amount || 0), 0)
  const pendingProviderPayouts = readyPayoutOrders.reduce((total, order) => total + Number(order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount)), 0)
  const bookingsToday = orders.filter((order) => order.createdAtDate?.toDateString() === todayKey).length

  const metrics = [
    ['Bookings today', loading ? '...' : String(bookingsToday)],
    ['Users', String(users.length)],
    ['Providers', String(providers.length)],
    ['Revenue', formatAmount(revenue)],
    ['Open requests', String(openOrders.length)],
    ['Applications', String(pendingApplications.length)],
    ['Payment reviews', String(reviewPaymentReceipts.length)],
    ['Sunday payouts', formatAmount(pendingProviderPayouts)],
  ]

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const haystack = [
        order.id,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.service,
        order.address,
        order.paymentReference,
        order.paymentReceiptText,
        order.paymentReceiptSenderPhone,
        order.paymentReceiptTransactionId,
      ].join(' ').toLowerCase()
      return matchesStatus && (!needle || haystack.includes(needle))
    })
  }, [orders, query, statusFilter])

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((user) => {
      const haystack = [user.name, user.email, user.phone, user.accountType].join(' ').toLowerCase()
      return !needle || haystack.includes(needle)
    })
  }, [users, query])

  const filteredPaymentReceipts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return paymentReceipts.filter((receipt) => {
      const haystack = [
        receipt.provider,
        receipt.paymentMethod,
        receipt.amount,
        receipt.senderPhone,
        receipt.transactionId,
        receipt.matchStatus,
        receipt.matchReason,
        receipt.matchedOrderId,
        receipt.message,
      ].join(' ').toLowerCase()
      return !needle || haystack.includes(needle)
    })
  }, [paymentReceipts, query])

  const filteredPayoutOrders = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      const shouldShow = order.providerUid && (isPayoutReady(order) || ['Paid', 'Partial', 'Held'].includes(order.payoutStatus))
      const haystack = [
        order.id,
        order.providerName,
        order.providerEmail,
        order.providerPhone,
        order.customerName,
        order.service,
        order.payoutStatus,
      ].join(' ').toLowerCase()
      return shouldShow && (!needle || haystack.includes(needle))
    })
  }, [orders, query])

  function exportData() {
    if (activeView === 'payments') {
      downloadCsv('carenest-payment-sms-receipts.csv', [
        ['Provider', 'Amount', 'Sender', 'Transaction ID', 'Match status', 'Matched order', 'Reason', 'Received'],
        ...filteredPaymentReceipts.map((receipt) => [
          receipt.paymentMethod || receipt.provider,
          receipt.amount,
          receipt.senderPhone,
          receipt.transactionId,
          receipt.matchStatus,
          receipt.matchedOrderId,
          receipt.matchReason,
          formatDate(receipt.receivedAtDate || receipt.createdAtDate),
        ]),
      ])
      return
    }

    if (activeView === 'payouts') {
      downloadCsv('carenest-provider-sunday-payouts.csv', [
        ['Order', 'Provider', 'Phone', 'Customer paid', 'Provider earning', 'CareNest fee', 'Payout status', 'Schedule', 'Paid at'],
        ...filteredPayoutOrders.map((order) => [
          order.id,
          order.providerName,
          order.providerPayoutPhone || order.providerPhone,
          order.amount,
          order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount),
          order.platformFee ?? calculatePlatformFee(order.amount),
          order.payoutStatus,
          order.payoutSchedule || 'Weekly Sunday',
          formatDate(order.payoutPaidAtDate),
        ]),
      ])
      return
    }

    if (activeView === 'users') {
      downloadCsv('carenest-users.csv', [
        ['Name', 'Email', 'Phone', 'Role', 'Joined'],
        ...filteredUsers.map((user) => [user.name, user.email, user.phone, user.accountType, formatDate(user.createdAtDate)]),
      ])
      return
    }

    downloadCsv('carenest-service-requests.csv', [
      ['Order', 'Customer', 'Email', 'Status', 'Service', 'Address', 'Amount', 'Payment method', 'Payment status', 'Payment reference', 'Customer payment message', 'Created'],
      ...filteredOrders.map((order) => [
        order.id,
        order.customerName,
        order.customerEmail,
        order.status,
        order.service,
        order.address,
        order.amount,
        order.paymentMethod,
        order.paymentStatus,
        order.paymentReference,
        order.paymentReceiptText,
        formatDate(order.createdAtDate),
      ]),
    ])
  }

  async function updateStatus(order, status) {
    try {
      await updateServiceRequestStatus(order.firestoreId, status)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function updatePayment(order, paymentStatus, note = '') {
    setError('')
    setMessage('')
    try {
      await updatePaymentStatus(order.firestoreId, paymentStatus, user.uid, note || `Marked ${paymentStatus.toLowerCase()} by admin.`)
      setMessage(`${order.id} payment marked as ${paymentStatus.toLowerCase()}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function updatePayout(order, payoutStatus, note = '') {
    setError('')
    setMessage('')
    if (['Paid', 'Partial'].includes(payoutStatus) && !isPayoutReady(order)) {
      setError('Only completed and paid jobs can be marked as provider paid.')
      return
    }
    const payoutAmount = payoutStatus === 'Partial'
      ? window.prompt('Enter the partial provider payout amount in FCFA.', String(order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount)))
      : null
    if (payoutStatus === 'Partial' && payoutAmount === null) return
    try {
      await updateProviderPayoutStatus(order.firestoreId, payoutStatus, user.uid, note || `Provider payout marked ${payoutStatus.toLowerCase()} by admin.`, payoutAmount)
      setMessage(`${order.id} provider payout marked as ${payoutStatus.toLowerCase()}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function assignProvider(order) {
    setError('')
    setMessage('')
    const providerUid = providerSelections[order.firestoreId] || order.providerUid || ''
    const provider = providers.find((nextProvider) => nextProvider.uid === providerUid)
    if (!provider) {
      setError('Choose a provider before assigning this request.')
      return
    }
    try {
      await adminAssignServiceRequest(order.firestoreId, provider, user.uid)
      setMessage(`${order.id} assigned to ${provider.name || provider.email}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function clearProvider(order) {
    setError('')
    setMessage('')
    try {
      await adminClearServiceRequestProvider(order.firestoreId, user.uid)
      setProviderSelections((current) => ({ ...current, [order.firestoreId]: '' }))
      setMessage(`${order.id} is back in pending jobs.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function reviewApplication(application, status) {
    setError('')
    setMessage('')
    try {
      if (status === 'Approved') {
        await approveProviderApplication(application, user.uid)
      } else {
        await rejectProviderApplication(application, user.uid)
      }
      setMessage(`${application.name} marked as ${status.toLowerCase()}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function setProviderCheck(application, field, value) {
    setError('')
    setMessage('')
    try {
      await updateProviderVerification(application, field, value, user.uid)
      setMessage('Provider verification check updated.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  const nav = [
    { label: 'Overview', to: '/dashboard/admin?view=overview', icon: 'dashboard' },
    { label: 'Users', to: '/dashboard/admin?view=users', icon: 'users' },
    { label: 'Requests', to: '/dashboard/admin?view=requests', icon: 'bookings' },
    { label: 'Payments', to: '/dashboard/admin?view=payments', icon: 'payments' },
    { label: 'Payouts', to: '/dashboard/admin?view=payouts', icon: 'payments' },
    { label: 'Applications', to: '/dashboard/admin?view=applications', icon: 'users' },
    { label: 'Settings', to: '/dashboard/admin?view=settings', icon: 'settings' },
  ]

  return (
    <DashboardShell
      title="Operations Dashboard"
      subtitle="Monitor bookings, users, providers, payments, and support."
      action={{ label: 'Export', onClick: exportData }}
      nav={nav}
      metrics={metrics}
    >
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      {activeView === 'overview' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>{loading ? 'Loading system activity...' : `${orders.length} service requests in the system`}</p>
            </div>
            <button className="dashboard-action-button" type="button" onClick={exportData}><FiDownload />Export</button>
          </div>
          {orders.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Service</th><th>Amount</th><th>Created</th></tr></thead>
              <tbody>
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.customerName || 'Customer'}</td>
                    <td><span className={`status-chip ${normalizeStatus(order.status)}`}>{order.status}</span></td>
                    <td>{order.service}</td>
                    <td>{formatAmount(order.amount)}</td>
                    <td>{formatDate(order.createdAtDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No service requests yet.</p>}
        </section>
      )}

      {activeView === 'users' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Users</h2>
              <p>{users.length} registered accounts across customers, providers, and admins.</p>
            </div>
            <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
          </div>
          {filteredUsers.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Verification</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid || user.firestoreId}>
                    <td>{user.name || 'Unnamed user'}</td>
                    <td>{user.email}</td>
                    <td>{user.phone || 'Not provided'}</td>
                    <td>{user.emailVerified ? 'Email verified' : 'Email pending'}{user.providerVerified ? ' · Provider verified' : ''}</td>
                    <td><span className="status-chip completed">{user.accountType}</span></td>
                    <td>{formatDate(user.createdAtDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No matching users found.</p>}
        </section>
      )}

      {activeView === 'requests' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Service requests</h2>
              <p>Track, filter, and update every customer booking.</p>
            </div>
            <div className="dashboard-tools">
              <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests" />
              <select className="dashboard-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>
          {filteredOrders.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Address</th><th>Amount</th><th>Provider</th><th>Payment ref</th><th>Evidence</th><th>Status</th><th>Payment</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.customerName || order.customerEmail || 'Customer'}</td>
                    <td>{order.service}</td>
                    <td>{order.address}</td>
                    <td>{formatAmount(order.amount)}</td>
                    <td className="admin-assignment-cell">
                      <select
                        className="dashboard-select"
                        value={providerSelections[order.firestoreId] ?? order.providerUid ?? ''}
                        onChange={(event) => setProviderSelections((current) => ({ ...current, [order.firestoreId]: event.target.value }))}
                      >
                        <option value="">Choose provider</option>
                        {providers.map((provider) => (
                          <option key={provider.uid || provider.firestoreId} value={provider.uid}>{provider.name || provider.email}</option>
                        ))}
                      </select>
                      <div className="table-action-row">
                        <button className="table-action" type="button" onClick={() => assignProvider(order)}>Assign</button>
                        {order.providerUid && <button className="table-action secondary" type="button" onClick={() => clearProvider(order)}>Unassign</button>}
                      </div>
                      {order.providerName && <small>Current: {order.providerName}</small>}
                    </td>
                    <td>{order.paymentReference || order.paymentReceiverNumber || 'Not submitted'}</td>
                    <td className="payment-receipt-cell">
                      {order.paymentReceiptText ? (
                        <details>
                          <summary>{order.paymentReceiptTransactionId || order.paymentReceiptSenderPhone || 'View message'}</summary>
                          <p>{order.paymentReceiptText}</p>
                          <small>
                            {order.paymentReceiptAmount ? `Amount: ${formatAmount(order.paymentReceiptAmount)}` : 'Amount not read'}
                            {order.paymentReceiptSenderPhone ? ` - Sender: ${order.paymentReceiptSenderPhone}` : ''}
                          </small>
                        </details>
                      ) : 'Not pasted'}
                      {order.completionProofText && <details><summary>Completion proof</summary><p>{order.completionProofText}</p></details>}
                      {order.complaintText && <details><summary>Complaint</summary><p>{order.complaintText}</p></details>}
                    </td>
                    <td>
                      <select className="dashboard-select" value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
                        {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="dashboard-select" value={order.paymentStatus || 'Pending'} onChange={(event) => updatePayment(order, event.target.value)}>
                        {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <div className="table-action-row">
                        <button className="table-action" type="button" onClick={() => updatePayment(order, 'Paid', 'Customer receipt accepted by admin.')}>Accept</button>
                        <button className="table-action danger" type="button" onClick={() => updatePayment(order, 'Failed', 'Customer receipt rejected by admin.')}>Reject</button>
                        <button className="table-action secondary" type="button" onClick={() => updatePayment(order, 'Refunded', 'Customer refund approved by admin.')}>Refund</button>
                      </div>
                      {order.paymentReviewNote && <small className="dashboard-muted">{order.paymentReviewNote}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No matching requests found.</p>}
        </section>
      )}

      {activeView === 'applications' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Provider applications</h2>
              <p>Review customers who want to become service providers.</p>
            </div>
          </div>
          {applications.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Services</th><th>Area</th><th>Verification</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.firestoreId}>
                    <td>{application.name}</td>
                    <td>{application.email}</td>
                    <td>{application.phone}</td>
                    <td>{application.services}</td>
                    <td>{application.area}</td>
                    <td>
                      <label><input type="checkbox" checked={Boolean(application.identityVerified)} onChange={(event) => setProviderCheck(application, 'identityVerified', event.target.checked)} /> Identity reviewed</label>
                      <label><input type="checkbox" checked={Boolean(application.payoutPhoneVerified)} onChange={(event) => setProviderCheck(application, 'payoutPhoneVerified', event.target.checked)} /> Payout phone confirmed</label>
                    </td>
                    <td><span className={`status-chip ${normalizeStatus(application.status)}`}>{application.status}</span></td>
                    <td>
                      {application.status === 'Pending' ? (
                        <div className="dashboard-tools">
                          <button className="table-action" type="button" disabled={!application.identityVerified || !application.payoutPhoneVerified} onClick={() => reviewApplication(application, 'Approved')}>Approve</button>
                          <button className="table-action danger" type="button" onClick={() => reviewApplication(application, 'Rejected')}>Reject</button>
                        </div>
                      ) : <span className="dashboard-muted">Reviewed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No provider applications yet.</p>}
        </section>
      )}

      {activeView === 'payments' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>SMS payment receipts</h2>
              <p>Review payment messages from the owner phone. Ambiguous receipts stay here until you confirm the right order in Requests.</p>
            </div>
            <div className="dashboard-tools">
              <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payment SMS" />
              <button className="dashboard-action-button" type="button" onClick={exportData}><FiDownload />Export</button>
            </div>
          </div>
          {filteredPaymentReceipts.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Provider</th><th>Amount</th><th>Sender</th><th>Transaction</th><th>Status</th><th>Order</th><th>Reason</th><th>Received</th></tr></thead>
              <tbody>
                {filteredPaymentReceipts.map((receipt) => (
                  <tr key={receipt.firestoreId}>
                    <td>{receipt.paymentMethod || receipt.provider}</td>
                    <td>{formatAmount(receipt.amount)}</td>
                    <td>{receipt.senderPhone || 'Not found'}</td>
                    <td>{receipt.transactionId || 'Not found'}</td>
                    <td><span className={`status-chip ${normalizeStatus(receipt.matchStatus)}`}>{receipt.matchStatus}</span></td>
                    <td>{receipt.matchedOrderId || 'Needs review'}</td>
                    <td>{receipt.matchReason || 'Verified automatically'}</td>
                    <td>{formatDate(receipt.receivedAtDate || receipt.createdAtDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No SMS payment receipts yet.</p>}
        </section>
      )}

      {activeView === 'payouts' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Sunday provider payouts</h2>
              <p>Pay providers manually every Sunday for jobs that are completed and already paid by the customer.</p>
            </div>
            <div className="dashboard-tools">
              <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payouts" />
              <button className="dashboard-action-button" type="button" onClick={exportData}><FiDownload />Export</button>
            </div>
          </div>
          {filteredPayoutOrders.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Order</th><th>Provider</th><th>Payout phone</th><th>Customer paid</th><th>Provider pay</th><th>CareNest fee</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredPayoutOrders.map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.providerName || 'Provider'}</td>
                    <td>{order.providerPayoutPhone || order.providerPhone || 'Not provided'}</td>
                    <td>{formatAmount(order.amount)}</td>
                    <td>{formatAmount(order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount))}</td>
                    <td>{formatAmount(order.platformFee ?? calculatePlatformFee(order.amount))}</td>
                    <td><span className={`status-chip ${normalizeStatus(order.payoutStatus)}`}>{order.payoutStatus}</span><small className="dashboard-muted">Weekly Sunday</small></td>
                    <td>
                      <select className="dashboard-select" value={order.payoutStatus || 'Unpaid'} onChange={(event) => updatePayout(order, event.target.value)}>
                        {payoutStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <div className="table-action-row">
                        <button className="table-action" type="button" onClick={() => updatePayout(order, 'Paid', 'Provider paid during Sunday payout.')}>Mark paid</button>
                        <button className="table-action secondary" type="button" onClick={() => updatePayout(order, 'Partial', 'Partial provider payout approved after review.')}>Partial</button>
                        <button className="table-action danger" type="button" onClick={() => updatePayout(order, 'Held', 'Provider payout held for review.')}>Hold</button>
                      </div>
                      {order.payoutNote && <small className="dashboard-muted">{order.payoutNote}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No provider payouts are ready yet.</p>}
        </section>
      )}

      {activeView === 'settings' && (
        <section className="dashboard-card-grid">
          <article className="dashboard-info-card"><span>Customers</span><strong>{customers.length}</strong></article>
          <article className="dashboard-info-card"><span>Providers</span><strong>{providers.length}</strong></article>
          <article className="dashboard-info-card"><span>Admins</span><strong>{admins.length}</strong></article>
          <article className="dashboard-info-card"><span>Open requests</span><strong>{openOrders.length}</strong></article>
          <article className="dashboard-info-card"><span>Completed requests</span><strong>{completedOrders.length}</strong></article>
          <article className="dashboard-info-card"><span>Complaints</span><strong>{complaints.length}</strong></article>
        </section>
      )}
    </DashboardShell>
  )
}

export default AdminDashboardPage
