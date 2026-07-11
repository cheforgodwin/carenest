import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { subscribeToCustomerOrders } from '../../firebase/orderService'
import {
  createProviderApplication,
  subscribeToMyProviderApplications,
} from '../../firebase/providerApplicationService'
import DashboardShell from './DashboardShell'

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

function CustomerDashboardPage() {
  const [searchParams] = useSearchParams()
  const activeView = searchParams.get('view') || 'overview'
  const { profile, user } = useAuth()
  const [orders, setOrders] = useState([])
  const [applications, setApplications] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [application, setApplication] = useState({
    phone: profile?.phone || '',
    services: '',
    area: '',
    experience: '',
  })

  useEffect(() => subscribeToCustomerOrders(
    user?.uid,
    setOrders,
    (nextError) => setError(nextError.message),
  ), [user?.uid])

  useEffect(() => subscribeToMyProviderApplications(
    user?.uid,
    setApplications,
    (nextError) => setError(nextError.message),
  ), [user?.uid])

  const activeOrders = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const totalSpent = orders
    .filter((order) => order.paymentStatus === 'Paid' || order.status === 'Completed')
    .reduce((total, order) => total + Number(order.amount || 0), 0)
  const latestApplication = useMemo(() => applications[0] || null, [applications])

  async function submitApplication(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createProviderApplication(user, profile, application)
      setMessage('Provider application submitted for admin review.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function updateApplication(event) {
    const { name, value } = event.target
    setApplication((current) => ({ ...current, [name]: value }))
  }

  const nav = [
    { label: 'Overview', to: '/dashboard/customer?view=overview', icon: 'dashboard' },
    { label: 'Bookings', to: '/customer', icon: 'bookings' },
    { label: 'Provider apply', to: '/dashboard/customer?view=provider-application', icon: 'users' },
  ]

  return (
    <DashboardShell
      title="Customer Dashboard"
      subtitle="Book services, track orders, manage payments, and apply as a provider."
      action={{ label: 'New booking', href: '/customer' }}
      nav={nav}
      metrics={[
        ['Active orders', String(activeOrders.length)],
        ['Total orders', String(orders.length)],
        ['Provider application', latestApplication?.status || 'Not started'],
        ['Total spent', formatAmount(totalSpent)],
      ]}
    >
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      {activeView === 'provider-application' ? (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Provider application</h2>
              <p>{latestApplication ? `Current status: ${latestApplication.status}` : 'Submit your details for operations review.'}</p>
            </div>
          </div>
          <form className="dashboard-form" onSubmit={submitApplication}>
            <label>Phone<input className="dashboard-input" name="phone" value={application.phone} onChange={updateApplication} required /></label>
            <label>Services<input className="dashboard-input" name="services" value={application.services} onChange={updateApplication} placeholder="Laundry, Cleaning, Delivery" required /></label>
            <label>Service area<input className="dashboard-input" name="area" value={application.area} onChange={updateApplication} placeholder="Bastos, Yaounde" required /></label>
            <label>Experience<textarea className="dashboard-input dashboard-textarea" name="experience" value={application.experience} onChange={updateApplication} placeholder="Tell us about your experience" required /></label>
            <button className="dashboard-action-button form-action" type="submit">Submit application</button>
          </form>
        </section>
      ) : (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Your bookings</h2>
              <p>{orders.length > 0 ? `${orders.length} service requests found.` : 'No service requests yet.'}</p>
            </div>
          </div>
          {orders.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Order</th><th>Service</th><th>Status</th><th>Payment</th><th>Pickup</th><th>Amount</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.firestoreId}>
                    <td>{order.id}</td>
                    <td>{order.service}</td>
                    <td><span className="status-chip">{order.status}</span></td>
                    <td>{order.paymentMethod || 'Cash'} - {order.paymentStatus || 'Pending'}</td>
                    <td>{formatDate(order.createdAtDate)}</td>
                    <td>{formatAmount(order.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">Choose a service to create your first booking.</p>}
        </section>
      )}
    </DashboardShell>
  )
}

export default CustomerDashboardPage
