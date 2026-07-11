import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiDownload } from 'react-icons/fi'
import {
  paymentStatuses,
  subscribeToAllOrders,
  subscribeToUsers,
  updatePaymentStatus,
  updateServiceRequestStatus,
} from '../../firebase/orderService'
import {
  approveProviderApplication,
  rejectProviderApplication,
  subscribeToProviderApplications,
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
  const [users, setUsers] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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
    return () => {
      unsubOrders()
      unsubUsers()
      unsubApplications()
    }
  }, [])

  const todayKey = new Date().toDateString()
  const providers = users.filter((user) => user.accountType === 'provider')
  const customers = users.filter((user) => user.accountType === 'customer')
  const admins = users.filter((user) => user.accountType === 'admin')
  const completedOrders = orders.filter((order) => order.status === 'Completed')
  const openOrders = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const complaints = orders.filter((order) => order.status === 'Complaint')
  const pendingApplications = applications.filter((application) => application.status === 'Pending')
  const revenue = completedOrders.reduce((total, order) => total + Number(order.amount || 0), 0)
  const bookingsToday = orders.filter((order) => order.createdAtDate?.toDateString() === todayKey).length

  const metrics = [
    ['Bookings today', loading ? '...' : String(bookingsToday)],
    ['Users', String(users.length)],
    ['Providers', String(providers.length)],
    ['Revenue', formatAmount(revenue)],
    ['Open requests', String(openOrders.length)],
    ['Applications', String(pendingApplications.length)],
  ]

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const haystack = [
        order.id,
        order.customerName,
        order.customerEmail,
        order.service,
        order.address,
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

  function exportData() {
    if (activeView === 'users') {
      downloadCsv('carenest-users.csv', [
        ['Name', 'Email', 'Phone', 'Role', 'Joined'],
        ...filteredUsers.map((user) => [user.name, user.email, user.phone, user.accountType, formatDate(user.createdAtDate)]),
      ])
      return
    }

    downloadCsv('carenest-service-requests.csv', [
      ['Order', 'Customer', 'Email', 'Status', 'Service', 'Address', 'Amount', 'Created'],
      ...filteredOrders.map((order) => [
        order.id,
        order.customerName,
        order.customerEmail,
        order.status,
        order.service,
        order.address,
        order.amount,
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

  async function updatePayment(order, paymentStatus) {
    try {
      await updatePaymentStatus(order.firestoreId, paymentStatus)
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

  const nav = [
    { label: 'Overview', to: '/dashboard/admin?view=overview', icon: 'dashboard' },
    { label: 'Users', to: '/dashboard/admin?view=users', icon: 'users' },
    { label: 'Requests', to: '/dashboard/admin?view=requests', icon: 'bookings' },
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
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid || user.firestoreId}>
                    <td>{user.name || 'Unnamed user'}</td>
                    <td>{user.email}</td>
                    <td>{user.phone || 'Not provided'}</td>
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
              <thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Address</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.customerName || order.customerEmail || 'Customer'}</td>
                    <td>{order.service}</td>
                    <td>{order.address}</td>
                    <td>{formatAmount(order.amount)}</td>
                    <td>
                      <select className="dashboard-select" value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
                        {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="dashboard-select" value={order.paymentStatus || 'Pending'} onChange={(event) => updatePayment(order, event.target.value)}>
                        {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
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
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Services</th><th>Area</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.firestoreId}>
                    <td>{application.name}</td>
                    <td>{application.email}</td>
                    <td>{application.phone}</td>
                    <td>{application.services}</td>
                    <td>{application.area}</td>
                    <td><span className={`status-chip ${normalizeStatus(application.status)}`}>{application.status}</span></td>
                    <td>
                      {application.status === 'Pending' ? (
                        <div className="dashboard-tools">
                          <button className="table-action" type="button" onClick={() => reviewApplication(application, 'Approved')}>Approve</button>
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
