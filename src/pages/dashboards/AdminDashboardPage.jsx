import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiDownload } from 'react-icons/fi'
import {
  adminAssignServiceRequest,
  adminClearServiceRequestProvider,
  subscribeToAllOrders,
  subscribeToPaymentSmsReceipts,
  subscribeToUsers,
  requestOrderRefund,
  assignServiceRequestToRider,
  updateServiceRequestStatus,
} from '../../firebase/orderService'
import {
  approveProviderApplication,
  rejectProviderApplication,
  subscribeToProviderApplications,
  updateProviderVerification,
} from '../../firebase/providerApplicationService'
import { getMarketplaceCategory, marketplaceCategoryEntries } from '../../config/marketplaceConfig'
import { adminSetListingVisibility, subscribeToAllListings } from '../../firebase/marketplaceService'
import { useAuth } from '../../auth/useAuth'
import DashboardShell from './DashboardShell'
import FinancePanel from '../../components/finance/FinancePanel'
import { useFinanceAlerts } from '../../components/finance/useFinanceAlerts'
import { financeTotals, csvCell } from '../../utils/finance'
import { useEffect } from 'react'
import './AdminMobile.css'

const statusOptions = ['Pending', 'Assigned', 'In Progress', 'Quality Check', 'Out for Delivery', 'Awaiting confirmation', 'Completed', 'Complaint', 'Cancelled']

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
    .map((row) => row.map(csvCell).join(','))
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
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listingVisibility, setListingVisibility] = useState('all')
  const [listingCategory, setListingCategory] = useState('all')
  const [riderSelections, setRiderSelections] = useState({})
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
    const unsubListings = subscribeToAllListings(
      setListings,
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
      unsubListings()
    }
  }, [])

  const financeAlerts = useFinanceAlerts(orders, user?.uid)
  const finances = financeTotals(orders.filter((order) => order.paymentEnvironment === 'live'))

  const todayKey = new Date().toDateString()
  const providers = users.filter((user) => user.accountType === 'provider')
  const riders = users.filter((user) => user.accountType === 'rider')
  const customers = users.filter((user) => user.accountType === 'customer')
  const admins = users.filter((user) => user.accountType === 'admin')
  const completedOrders = orders.filter((order) => order.status === 'Completed')
  const openOrders = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const complaints = orders.filter((order) => order.status === 'Complaint')
  const pendingApplications = applications.filter((application) => application.status === 'Pending')
  const reviewPaymentReceipts = paymentReceipts.filter((receipt) => receipt.matchStatus === 'needs_review')
  const bookingsToday = orders.filter((order) => order.createdAtDate?.toDateString() === todayKey).length

  const metrics = [
    ['Bookings today', loading ? '...' : String(bookingsToday)],
    ['Users', String(users.length)],
    ['Customers', String(customers.length)],
    ['Providers', String(providers.length)],
    ['Listings', String(listings.length)],
    ['Riders', String(riders.length)],
    ['Live customer collections', formatAmount(finances.collected)],
    ['Open requests', String(openOrders.length)],
    ['Applications', String(pendingApplications.length)],
    ['Payment reviews', String(reviewPaymentReceipts.length)],
    ['CareNest earned (confirmed)', formatAmount(finances.platform)],
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

  const filteredListings = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return listings.filter((listing) => {
      const matchesVisibility = listingVisibility === 'all'
        || (listingVisibility === 'active' && listing.active)
        || (listingVisibility === 'hidden' && !listing.active)
      const matchesCategory = listingCategory === 'all' || listing.category === listingCategory
      const haystack = [
        listing.title, listing.description, listing.providerName, listing.providerPhone,
        listing.serviceArea, listing.category, listing.moderationStatus,
      ].join(' ').toLowerCase()
      return matchesVisibility && matchesCategory && (!needle || haystack.includes(needle))
    })
  }, [listings, listingCategory, listingVisibility, query])
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

  async function requestRefund(order) {
    setError('')
    setMessage('')
    const note = window.prompt('Why is a refund needed? This records a request and holds settlement; it does not send money.')
    if (!note?.trim()) return
    try {
      await requestOrderRefund(order.firestoreId, user.uid, note.trim())
      setMessage('Refund request recorded. Payment remains paid until an actual refund is verified.')
    } catch (nextError) { setError(nextError.message) }
  }

  async function assignRider(order) {
    setError('')
    setMessage('')
    const rider = riders.find((item) => item.uid === riderSelections[order.firestoreId])
    if (!rider) { setError('Choose a rider first.'); return }
    try {
      await assignServiceRequestToRider(order.firestoreId, rider)
      setMessage('Rider assigned. Pickup must be recorded before delivery.')
    } catch (nextError) { setError(nextError.message) }
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

  async function reviewListing(listing, active) {
    setError('')
    setMessage('')
    const note = window.prompt(
      active ? 'Optional approval note for this listing.' : 'Why are you hiding this listing?',
      listing.moderationNote || '',
    )
    if (note === null) return
    try {
      await adminSetListingVisibility(listing.firestoreId, active, user.uid, note)
      setMessage(listing.title + (active ? ' is published in the marketplace.' : ' has been hidden from customers.'))
    } catch (nextError) {
      setError(nextError.message)
    }
  }
  const nav = [
    { label: 'Overview', to: '/dashboard/admin?view=overview', icon: 'dashboard' },
    { label: `Notifications (${financeAlerts.alerts.length})`, to: '/dashboard/admin?view=notifications', icon: 'payments' },
    { label: 'Users', to: '/dashboard/admin?view=users', icon: 'users' },
    { label: 'Requests', to: '/dashboard/admin?view=requests', icon: 'bookings' },
    { label: 'SMS receipts', to: '/dashboard/admin?view=payments', icon: 'payments' },
    { label: 'Transactions & earnings', to: '/dashboard/admin?view=finance', icon: 'payments' },
    { label: 'Applications', to: '/dashboard/admin?view=applications', icon: 'users' },
    { label: 'Marketplace', to: '/dashboard/admin?view=marketplace', icon: 'bookings' },
    { label: 'Settings', to: '/dashboard/admin?view=settings', icon: 'settings' },
  ]

  return (
    <DashboardShell
      className="admin-dashboard"
      title="Operations Dashboard"
      subtitle="Monitor bookings, users, providers, payments, and support."
      action={['finance', 'payouts', 'notifications'].includes(activeView) ? undefined : { label: 'Export', onClick: exportData }}
      nav={nav}
      metrics={metrics}
    >
      {financeAlerts.alerts.length > 0 && <Link className="finance-attention-banner" to="/dashboard/admin?view=notifications" aria-live="polite">{financeAlerts.alerts.length} transaction item(s) need your attention. Review payments, refunds and payouts.</Link>}
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      {activeView === 'notifications' && <section className="dashboard-panel admin-notifications">
        <div className="dashboard-panel-header"><div><h2>Notifications</h2><p>Transactions needing your attention, available whenever you open CareNest on your phone.</p></div>
          <button type="button" className="dashboard-action-button" disabled={financeAlerts.permission === 'unsupported' || financeAlerts.permission === 'denied'} onClick={financeAlerts.enableNotifications}>Enable browser alerts</button></div>
        <p className="finance-note">In-app notifications work without browser permission. Optional browser alerts require this dashboard to remain open. {financeAlerts.permission === 'denied' ? 'Browser alerts are blocked in your browser settings.' : ''}</p>
        <p role="status">{loading ? 'Loading notifications...' : `${financeAlerts.alerts.length} item(s) need attention.`}</p>
        <div className="admin-notification-list">{financeAlerts.alerts.map((alert) => <article className="admin-notification" key={alert.id}>
          <div><strong>{alert.label || 'Transaction review'}</strong><p>{alert.message}</p></div>
          <Link className="table-action" to={'/dashboard/admin?view=finance&order=' + encodeURIComponent(alert.orderId)}>Review transaction</Link>
        </article>)}</div>
        {!loading && !financeAlerts.alerts.length && <p className="dashboard-empty">You are up to date. New transaction issues will appear here automatically.</p>}
      </section>}

      {activeView === 'overview'  && (
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
                    <td data-label="Order">{order.id}</td>
                    <td data-label="Customer">{order.customerName || 'Customer'}</td>
                    <td data-label="Status"><span className={`status-chip ${normalizeStatus(order.status)}`}>{order.status}</span></td>
                    <td data-label="Service">{order.service}</td>
                    <td data-label="Amount">{formatAmount(order.amount)}</td>
                    <td data-label="Created">{formatDate(order.createdAtDate)}</td>
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
                    <td data-label="Name">{user.name || 'Unnamed user'}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Phone">{user.phone || 'Not provided'}</td>
                    <td data-label="Verification">{user.emailVerified ? 'Email verified' : 'Email pending'}{user.providerVerified ? ' · Provider verified' : ''}</td>
                    <td data-label="Role"><span className="status-chip completed">{user.accountType}</span></td>
                    <td data-label="Joined">{formatDate(user.createdAtDate)}</td>
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
            <table className="dashboard-table admin-requests-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Address</th><th>Amount</th><th>Provider</th><th>Payment ref</th><th>Evidence</th><th>Status</th><th>Payment</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.firestoreId}>
                    <td data-label="Order">{order.id}</td>
                    <td data-label="Customer">{order.customerName || order.customerEmail || 'Customer'}</td>
                    <td data-label="Service">{order.service}</td>
                    <td data-label="Address">{order.address}</td>
                    <td data-label="Amount">{formatAmount(order.amount)}</td>
                    <td className="admin-assignment-cell" data-label="Provider">
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
                    <td data-label="Payment ref">{order.paymentReference || order.paymentReceiverNumber || 'Not submitted'}</td>
                    <td className="payment-receipt-cell" data-label="Evidence">
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
                    <td data-label="Status">
                      {order.serviceType === 'delivery' && order.status === 'Out for Delivery' && !order.riderUid && order.paymentStatus === 'Paid' && <div>
                        <select aria-label="Choose rider" value={riderSelections[order.firestoreId] || ''} onChange={(event) => setRiderSelections((current) => ({ ...current, [order.firestoreId]: event.target.value }))}>
                          <option value="">Choose rider</option>{riders.map((rider) => <option key={rider.uid} value={rider.uid}>{rider.name || rider.email}</option>)}
                        </select><button type="button" className="table-action" onClick={() => assignRider(order)}>Assign rider</button>
                      </div>}
                      {order.riderUid && <small>Rider: {order.riderName} - {order.riderStatus}</small>}

                      <select className="dashboard-select" value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
                        {[order.status, ...(!['Completed', 'Cancelled', 'Complaint'].includes(order.status) ? ['Complaint', 'Cancelled'] : [])].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td data-label="Payment">
                      {order.paymentStatus === 'Paid' ? (
                        <><span className="status-chip completed">Paid automatically</span><button className="table-action secondary" type="button" disabled={order.refundStatus === 'Requested'} onClick={() => requestRefund(order)}>Request refund review</button>{order.refundStatus && <small>Refund: {order.refundStatus}</small>}</>
                      ) : (
                        <>
                          <strong>{order.paymentStatus || 'Pending'}</strong>
                          <div className="table-action-row">
                          </div>
                          {order.paymentStatus === 'Submitted' && <small className="dashboard-muted">Awaiting automatic provider verification.</small>}
                        </>
                      )}
                      {order.paymentReviewNote && <small className="dashboard-muted">{order.paymentReviewNote}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No matching requests found.</p>}
        </section>
      )}

      {activeView === 'marketplace' && (
        <section className="dashboard-panel admin-marketplace-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Marketplace operations</h2>
              <p>Review provider storefronts, control customer visibility, and monitor pricing and stock.</p>
            </div>
            <div className="dashboard-tools">
              <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listings or providers" />
              <select className="dashboard-select" value={listingCategory} onChange={(event) => setListingCategory(event.target.value)}>
                <option value="all">All categories</option>
                {marketplaceCategoryEntries.map(([value, category]) => <option key={value} value={value}>{category.label}</option>)}
              </select>
              <select className="dashboard-select" value={listingVisibility} onChange={(event) => setListingVisibility(event.target.value)}>
                <option value="all">All visibility</option>
                <option value="active">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div className="marketplace-ops-summary">
            <article><span>Total listings</span><strong>{listings.length}</strong></article>
            <article><span>Published</span><strong>{listings.filter((listing) => listing.active).length}</strong></article>
            <article><span>Hidden</span><strong>{listings.filter((listing) => !listing.active).length}</strong></article>
            <article><span>Low or no stock</span><strong>{listings.filter((listing) => listing.stockTracked && listing.stockQuantity < 3).length}</strong></article>
          </div>
          <div className="marketplace-listing-grid admin-marketplace-grid">
            {filteredListings.map((listing) => (
              <article className="marketplace-listing-card admin-marketplace-card" key={listing.firestoreId}>
                <div className="admin-listing-heading">
                  <span>{getMarketplaceCategory(listing.category).label}</span>
                  <b className={'status-chip ' + (listing.active ? 'paid' : 'held')}>{listing.active ? 'Published' : 'Hidden'}</b>
                </div>
                <h3>{listing.title}</h3>
                <p>{listing.description}</p>
                <strong>{formatAmount(listing.price)} / {listing.unit}</strong>
                <dl>
                  <div><dt>Provider</dt><dd>{listing.providerName}</dd></div>
                  <div><dt>Phone</dt><dd>{listing.providerPhone || 'Not supplied'}</dd></div>
                  <div><dt>Area</dt><dd>{listing.serviceArea}</dd></div>
                  <div><dt>Fulfilment</dt><dd>{listing.turnaround || 'Not specified'}</dd></div>
                  <div><dt>Stock</dt><dd>{listing.stockTracked ? listing.stockQuantity : 'Not tracked'}</dd></div>
                  <div><dt>Reviewed</dt><dd>{listing.moderationStatus || 'Not reviewed'}</dd></div>
                </dl>
                {listing.options?.length > 0 && <small>Options: {listing.options.join(', ')}</small>}
                {listing.moderationNote && <p className="admin-moderation-note">{listing.moderationNote}</p>}
                <div className="table-action-row">
                  {!listing.active && <button className="table-action" type="button" onClick={() => reviewListing(listing, true)}>Publish</button>}
                  {listing.active && <button className="table-action danger" type="button" onClick={() => reviewListing(listing, false)}>Hide</button>}
                </div>
              </article>
            ))}
            {filteredListings.length === 0 && <p className="dashboard-empty">No marketplace listings match these filters.</p>}
          </div>
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
                    <td data-label="Name">{application.name}</td>
                    <td data-label="Email">{application.email}</td>
                    <td data-label="Phone">{application.phone}</td>
                    <td data-label="Services">{application.services}</td>
                    <td data-label="Area">{application.area}</td>
                    <td data-label="Verification">
                      <label><input type="checkbox" checked={Boolean(application.identityVerified)} onChange={(event) => setProviderCheck(application, 'identityVerified', event.target.checked)} /> Identity reviewed</label>
                      <label><input type="checkbox" checked={Boolean(application.payoutPhoneVerified)} onChange={(event) => setProviderCheck(application, 'payoutPhoneVerified', event.target.checked)} /> Payout phone confirmed</label>
                    </td>
                    <td data-label="Status"><span className={`status-chip ${normalizeStatus(application.status)}`}>{application.status}</span></td>
                    <td data-label="Action">
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
              <p>Review payment messages from the owner phone. Messages are supporting evidence; collections must be verified with Fapshi in Transactions & earnings.</p>
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
                    <td data-label="Provider">{receipt.paymentMethod || receipt.provider}</td>
                    <td data-label="Amount">{formatAmount(receipt.amount)}</td>
                    <td data-label="Sender">{receipt.senderPhone || 'Not found'}</td>
                    <td data-label="Transaction">{receipt.transactionId || 'Not found'}</td>
                    <td data-label="Status"><span className={`status-chip ${normalizeStatus(receipt.matchStatus)}`}>{receipt.matchStatus}</span></td>
                    <td data-label="Order">{receipt.matchedOrderId || 'Needs review'}</td>
                    <td data-label="Reason">{receipt.matchReason || 'Verified automatically'}</td>
                    <td data-label="Received">{formatDate(receipt.receivedAtDate || receipt.createdAtDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No SMS payment receipts yet.</p>}
        </section>
      )}

      {['finance', 'payouts'].includes(activeView) && <FinancePanel key={searchParams.get('order') || 'all'} initialSelected={searchParams.get('order') || ''} orders={orders} {...financeAlerts} />}

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
