import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiCamera } from 'react-icons/fi'
import { useAuth } from '../../auth/useAuth'
import { phonePlaceholder, serviceAreaPlaceholder } from '../../config/businessConfig'
import {
  assignServiceRequestToProvider,
  subscribeToOpenProviderOrders,
  subscribeToProviderOrders,
  updateProviderAvailability,
  updateServiceRequestStatus,
} from '../../firebase/orderService'
import { uploadProviderBusinessPhoto } from '../../firebase/profilePhotoService'
import DashboardShell from './DashboardShell'

const providerStatuses = ['Assigned', 'In Progress', 'Quality Check', 'Out for Delivery', 'Completed']

function formatAmount(amount) {
  return `${Number(amount || 0).toLocaleString()} FCFA`
}

function normalizeStatus(status) {
  return String(status || 'Pending').toLowerCase().replace(/\s+/g, '-')
}

function getArea(address = '') {
  return address.split(',')[0] || 'Not set'
}

function ProviderDashboardPage() {
  const [searchParams] = useSearchParams()
  const activeView = searchParams.get('view') || 'overview'
  const { profile, setSession, user } = useAuth()
  const [orders, setOrders] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState(() => ({
    status: profile?.availability?.status || 'Available',
    area: profile?.availability?.area || '',
    services: profile?.availability?.services || '',
    phone: profile?.phone || '',
  }))
  const [photoStatus, setPhotoStatus] = useState({ loading: false, error: '', message: '' })

  useEffect(() => {
    const unsubOpen = subscribeToOpenProviderOrders(
      setOpenOrders,
      (nextError) => setError(nextError.message),
    )
    const unsubMine = subscribeToProviderOrders(
      user?.uid,
      setOrders,
      (nextError) => setError(nextError.message),
    )
    return () => {
      unsubOpen()
      unsubMine()
    }
  }, [user?.uid])

  const openJobs = openOrders.filter((order) => !order.providerUid && order.status === 'Pending')
  const myJobs = orders.filter((order) => order.providerUid === user.uid)
  const activeJobs = myJobs.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const completedJobs = myJobs.filter((order) => order.status === 'Completed')
  const earnings = completedJobs.reduce((total, order) => total + Number(order.amount || 0), 0)
  const sourceJobs = activeView === 'jobs' ? [...openJobs, ...myJobs] : [...activeJobs, ...openJobs].slice(0, 8)
  const needle = query.trim().toLowerCase()
  const visibleJobs = sourceJobs.filter((order) => {
    const haystack = [order.id, order.service, order.address, order.customerName, order.status].join(' ').toLowerCase()
    return !needle || haystack.includes(needle)
  })

  const metrics = [
    ['Open jobs', String(openJobs.length)],
    ['Active jobs', String(activeJobs.length)],
    ['Completed', String(completedJobs.length)],
    ['Earnings', formatAmount(earnings)],
  ]

  async function acceptJob(order) {
    setError('')
    setMessage('')
    try {
      await assignServiceRequestToProvider(order.firestoreId, {
        uid: user.uid,
        name: profile?.name || user.displayName || 'Provider',
        email: user.email,
      })
      setMessage(`${order.id} assigned to you.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function updateStatus(order, status) {
    setError('')
    setMessage('')
    try {
      await updateServiceRequestStatus(order.firestoreId, status)
      setMessage(`${order.id} moved to ${status}.`)
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function saveAvailability(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await updateProviderAvailability(user.uid, availability)
      setMessage('Availability saved.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function updateAvailability(event) {
    const { name, value } = event.target
    setAvailability((current) => ({ ...current, [name]: value }))
  }

  async function uploadBusinessPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoStatus({ loading: true, error: '', message: '' })
    try {
      const uploaded = await uploadProviderBusinessPhoto(user, file)
      setSession({ ...profile, ...uploaded })
      setPhotoStatus({ loading: false, error: '', message: 'Professional photo updated.' })
    } catch (nextError) {
      setPhotoStatus({ loading: false, error: nextError.message, message: '' })
    }
  }

  const nav = [
    { label: 'Overview', to: '/dashboard/provider?view=overview', icon: 'dashboard' },
    { label: 'Jobs', to: '/dashboard/provider?view=jobs', icon: 'bookings' },
    { label: 'Settings', to: '/dashboard/provider?view=settings', icon: 'settings' },
  ]

  return (
    <DashboardShell
      title="Provider Dashboard"
      subtitle="Accept jobs, manage availability, and monitor earnings."
      action={{ label: 'Set availability', href: '/dashboard/provider?view=settings' }}
      nav={nav}
      metrics={metrics}
    >
      {error && <p className="dashboard-error">{error}</p>}
      {message && <p className="dashboard-success">{message}</p>}

      {(activeView === 'overview' || activeView === 'jobs') && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>{activeView === 'jobs' ? 'Jobs' : 'Recent activity'}</h2>
              <p>{activeView === 'jobs' ? 'Accept open jobs and update assigned work.' : 'Your active work and available customer requests.'}</p>
            </div>
            <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" />
          </div>
          {visibleJobs.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Job</th><th>Customer</th><th>Type</th><th>Status</th><th>Area</th><th>Payout</th><th>Action</th></tr></thead>
              <tbody>
                {visibleJobs.map((order) => {
                  const assignedToMe = order.providerUid === user.uid
                  return (
                    <tr key={order.firestoreId}>
                      <td>{order.id}</td>
                      <td>{order.customerName || 'Customer'}</td>
                      <td>{order.service}</td>
                      <td><span className={`status-chip ${normalizeStatus(order.status)}`}>{order.status}</span></td>
                      <td>{getArea(order.address)}</td>
                      <td>{formatAmount(order.amount)}</td>
                      <td>
                        {!order.providerUid ? (
                          <button className="table-action" type="button" onClick={() => acceptJob(order)}>Accept</button>
                        ) : assignedToMe ? (
                          <select className="dashboard-select" value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
                            {providerStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        ) : <span className="dashboard-muted">Assigned</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <p className="dashboard-empty">No jobs found yet.</p>}
        </section>
      )}

      {activeView === 'settings' && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Availability</h2>
              <p>Set your status, service area, and services so operations can route work properly.</p>
            </div>
          </div>
          <div className="provider-profile-upload">
            <div className="provider-profile-preview">{profile?.businessPhotoURL ? <img src={profile.businessPhotoURL} alt="Provider professional or service location" /> : <FiCamera />}</div>
            <div><h3>Professional or business photo</h3><p>Upload a clear portrait, laundry point, workshop, or service location so customers can recognize your business.</p><label className="dashboard-action-button">{photoStatus.loading ? 'Uploading…' : 'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadBusinessPhoto} disabled={photoStatus.loading} /></label>{(photoStatus.error || photoStatus.message) && <small className={photoStatus.error ? 'error' : ''} role="status">{photoStatus.error || photoStatus.message}</small>}</div>
          </div>
          <form className="dashboard-form" onSubmit={saveAvailability}>
            <label>Status<select className="dashboard-select" name="status" value={availability.status} onChange={updateAvailability}>
              <option>Available</option>
              <option>Busy</option>
              <option>Offline</option>
            </select></label>
            <label>Service area<input className="dashboard-input" name="area" value={availability.area} onChange={updateAvailability} placeholder={serviceAreaPlaceholder} /></label>
            <label>Services<input className="dashboard-input" name="services" value={availability.services} onChange={updateAvailability} placeholder="Laundry, Cleaning, Delivery" /></label>
            <label>Phone<input className="dashboard-input" name="phone" value={availability.phone} onChange={updateAvailability} placeholder={phonePlaceholder} /></label>
            <button className="dashboard-action-button form-action" type="submit">Save availability</button>
          </form>
        </section>
      )}
    </DashboardShell>
  )
}

export default ProviderDashboardPage
