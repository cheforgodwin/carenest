import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { phonePlaceholder, serviceAreaPlaceholder } from '../../config/businessConfig'
import { getMarketplaceCategory, marketplaceCategoryEntries } from '../../config/marketplaceConfig'
import {
  calculateProviderEarning,
  assignServiceRequestToProvider,
  isPayoutReady,
  subscribeToOpenProviderOrders,
  subscribeToProviderOrders,
  updateProviderJobStatus,
  updateProviderAvailability,
} from '../../firebase/orderService'

import {
  createProviderListing,
  setProviderListingActive,
  subscribeToProviderListings,
} from '../../firebase/marketplaceService'

import DashboardShell from './DashboardShell'

const providerStatuses = ['Pending', 'Assigned', 'In Progress', 'Quality Check', 'Out for Delivery', 'Completed']

const emptyListing = {
  category: 'gas', title: '', description: '', price: '', unit: 'cylinder', serviceArea: '',
  turnaround: '', options: '', stockTracked: true, stockQuantity: '', active: true,
}

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
  const { profile, user } = useAuth()
  const [orders, setOrders] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [listings, setListings] = useState([])
  const [listingForm, setListingForm] = useState(emptyListing)
  const [availability, setAvailability] = useState(() => ({
    status: profile?.availability?.status || 'Available',
    area: profile?.availability?.area || '',
    services: profile?.availability?.services || '',
    phone: profile?.phone || '',
    payoutMethod: profile?.payout?.method || 'MTN Mobile Money',
    payoutPhone: profile?.payout?.phone || profile?.phone || '',
  }))

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

  useEffect(() => subscribeToProviderListings(
    user?.uid,
    setListings,
    (nextError) => setError(nextError.message),
  ), [user?.uid])

  const openJobs = openOrders.filter((order) => !order.providerUid && order.status === 'Pending')
  const myJobs = orders.filter((order) => order.providerUid === user.uid)
  const activeJobs = myJobs.filter((order) => !['Completed', 'Cancelled'].includes(order.status))
  const completedJobs = myJobs.filter((order) => order.status === 'Completed')
  const readyPayoutJobs = completedJobs.filter(isPayoutReady)
  const earnings = readyPayoutJobs.reduce((total, order) => total + Number(order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount)), 0)
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
    ['Sunday payout', formatAmount(earnings)],
  ]

  async function acceptJob(order) {
    setError('')
    setMessage('')
    try {
      await assignServiceRequestToProvider(order.firestoreId, {
        uid: user.uid,
        name: profile?.name || user.displayName || 'Provider',
        email: user.email,
        phone: profile?.phone || availability.phone || '',
        payout: profile?.payout || {
          method: availability.payoutMethod,
          phone: availability.payoutPhone || availability.phone,
        },
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
      const proofText = status === 'Completed'
        ? window.prompt('Add a short completion note before this job becomes payable on Sunday.', order.completionProofText || '')
        : ''
      if (status === 'Completed' && proofText === null) return
      await updateProviderJobStatus(order.firestoreId, status, proofText || '')
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

  function updateListingForm(event) {
    const { name, value, type, checked } = event.target
    setListingForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value }
      if (name === 'category') next.unit = getMarketplaceCategory(value).unitLabel
      return next
    })
  }

  async function saveListing(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createProviderListing({
        uid: user.uid,
        name: profile?.name || user.displayName,
        phone: profile?.phone || availability.phone,
      }, listingForm)
      setListingForm({ ...emptyListing, serviceArea: listingForm.serviceArea })
      setMessage('Your storefront listing is now available to customers.')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function toggleListing(listing) {
    setError('')
    try {
      await setProviderListingActive(listing.firestoreId, !listing.active)
      setMessage(listing.title + ' is now ' + (listing.active ? 'hidden.' : 'available.'))
    } catch (nextError) {
      setError(nextError.message)
    }
  }
  const nav = [
    { label: 'Overview', to: '/dashboard/provider?view=overview', icon: 'dashboard' },
    { label: 'Jobs', to: '/dashboard/provider?view=jobs', icon: 'bookings' },
    { label: 'Storefront', to: '/dashboard/provider?view=storefront', icon: 'bookings' },
    { label: 'Settings', to: '/dashboard/provider?view=settings', icon: 'settings' },
  ]

  return (
    <DashboardShell
      title="Provider Dashboard"
      subtitle="View available customer jobs, accept work yourself, and manage availability."
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
              <p>{activeView === 'jobs' ? 'Accept available jobs or update work already assigned to you. Provider pay is released weekly on Sunday for completed and paid jobs.' : 'Available customer requests, active jobs, and Sunday payout work.'}</p>
            </div>
            <input className="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" />
          </div>
          {visibleJobs.length > 0 ? (
            <table className="dashboard-table">
              <thead><tr><th>Job</th><th>Customer</th><th>Type</th><th>Status</th><th>Area</th><th>Provider pay</th><th>Payout</th><th>Action</th></tr></thead>
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
                      <td>{formatAmount(order.providerPayoutAmount ?? order.providerEarning ?? calculateProviderEarning(order.amount))}</td>
                      <td><span className={`status-chip ${normalizeStatus(order.payoutStatus)}`}>{order.payoutStatus || 'Unpaid'}</span></td>
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

      {activeView === 'storefront' && (
        <section className="dashboard-panel marketplace-manager">
          <div className="dashboard-panel-header">
            <div>
              <h2>Your storefront</h2>
              <p>Publish products and services from one place. Customers receive the right order form for each category.</p>
            </div>
          </div>
          <form className="marketplace-listing-form" onSubmit={saveListing}>
            <label>Category<select className="dashboard-select" name="category" value={listingForm.category} onChange={updateListingForm}>
              {marketplaceCategoryEntries.map(([value, category]) => <option key={value} value={value}>{category.label}</option>)}
            </select></label>
            <label>Listing title<input className="dashboard-input" name="title" value={listingForm.title} onChange={updateListingForm} placeholder="E.g. 12.5 kg gas refill" required /></label>
            <label>Price (FCFA)<input className="dashboard-input" name="price" type="number" min="100" step="1" value={listingForm.price} onChange={updateListingForm} required /></label>
            <label>Price unit<input className="dashboard-input" name="unit" value={listingForm.unit} onChange={updateListingForm} placeholder="cylinder, item, visit…" required /></label>
            <label>Service area<input className="dashboard-input" name="serviceArea" value={listingForm.serviceArea} onChange={updateListingForm} placeholder={serviceAreaPlaceholder} required /></label>
            <label>Fulfilment time<input className="dashboard-input" name="turnaround" value={listingForm.turnaround} onChange={updateListingForm} placeholder="E.g. 45–90 minutes" /></label>
            <label className="marketplace-form-wide">{getMarketplaceCategory(listingForm.category).listingPrompt}<input className="dashboard-input" name="options" value={listingForm.options} onChange={updateListingForm} placeholder="E.g. 6 kg, 12.5 kg, 50 kg" /></label>
            <label className="marketplace-form-wide">Description<textarea className="dashboard-input dashboard-textarea" name="description" value={listingForm.description} onChange={updateListingForm} minLength="10" placeholder="Tell customers exactly what is included." required /></label>
            {getMarketplaceCategory(listingForm.category).kind === 'product' && <>
              <label className="marketplace-check"><input name="stockTracked" type="checkbox" checked={listingForm.stockTracked} onChange={updateListingForm} /> Track stock</label>
              {listingForm.stockTracked && <label>Stock available<input className="dashboard-input" name="stockQuantity" type="number" min="0" step="1" value={listingForm.stockQuantity} onChange={updateListingForm} /></label>}
            </>}
            <label className="marketplace-check"><input name="active" type="checkbox" checked={listingForm.active} onChange={updateListingForm} /> Publish immediately</label>
            <button className="dashboard-action-button form-action" type="submit">Add to storefront</button>
          </form>
          <div className="marketplace-listing-grid">
            {listings.map((listing) => (
              <article className="marketplace-listing-card" key={listing.firestoreId}>
                <span>{getMarketplaceCategory(listing.category).label}</span>
                <h3>{listing.title}</h3>
                <p>{listing.description}</p>
                <strong>{formatAmount(listing.price)} / {listing.unit}</strong>
                <small>{listing.serviceArea}{listing.turnaround ? ' · ' + listing.turnaround : ''}</small>
                {listing.stockTracked && <small>{listing.stockQuantity} in stock</small>}
                <button className={listing.active ? 'table-action secondary' : 'table-action'} type="button" onClick={() => toggleListing(listing)}>{listing.active ? 'Hide listing' : 'Publish listing'}</button>
              </article>
            ))}
            {listings.length === 0 && <p className="dashboard-empty">Your storefront is empty. Add your first product or service above.</p>}
          </div>
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
            <div className="provider-profile-preview"><span className="avatar">{profile?.name?.split(/\s+/).map((part) => part[0]?.toUpperCase()).slice(0, 2).join('') || 'PR'}</span></div>
            <div><h3>Professional initials</h3><p>Provider avatar is generated from your name initials.</p></div>
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
            <label>Payout method<select className="dashboard-select" name="payoutMethod" value={availability.payoutMethod} onChange={updateAvailability}>
              <option>MTN Mobile Money</option>
              <option>Orange Money</option>
            </select></label>
            <label>Payout phone<input className="dashboard-input" name="payoutPhone" value={availability.payoutPhone} onChange={updateAvailability} placeholder={phonePlaceholder} /></label>
            <button className="dashboard-action-button form-action" type="submit">Save availability</button>
          </form>
        </section>
      )}
    </DashboardShell>
  )
}

export default ProviderDashboardPage
