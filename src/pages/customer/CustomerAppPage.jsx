import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiGift,
  FiHome,
  FiMapPin,
  FiMenu,
  FiPackage,
  FiPhone,
  FiShoppingBag,
  FiTool,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { useAuth } from '../../auth/useAuth'
import {
  defaultCustomerAddress,
  defaultCustomerCity,
  getStartingPrice,
  phonePlaceholder,
  serviceAddresses,
  servicePrices,
  supportPhoneHref,
} from '../../config/businessConfig'
import Logo from '../../components/Logo'
import { createRequestId, createServiceRequest, subscribeToCustomerOrders } from '../../firebase/orderService'
import { uploadCustomerProfilePhoto } from '../../firebase/profilePhotoService'
import './CustomerAppPage.css'

const quickActions = [
  ['Laundry', FiShoppingBag, '/dashboard/customer/request/laundry'],
  ['Cleaning', FiTool, '/dashboard/customer/request/cleaning'],
  ['Delivery', FiPackage, '/dashboard/customer/request/delivery'],
  ['Call CareNest', FiPhone, supportPhoneHref],
]

const services = [
  ['Laundry Service', 'We wash, iron and deliver to your door.', 'laundry', getStartingPrice('laundry')],
  ['Home Cleaning', 'Professional cleaning for your home.', 'cleaning', getStartingPrice('cleaning')],
  ['Essentials Delivery', 'Order household essentials and we deliver fast.', 'delivery', getStartingPrice('delivery')],
]

const timelineSteps = [
  'Requested',
  'Assigned',
  'In Progress',
  'Quality Check',
  'Out for Delivery',
  'Completed',
]

const serviceConfig = {
  laundry: {
    label: 'Laundry',
    title: 'Laundry Request',
    icon: FiShoppingBag,
    heading: 'Fresh laundry, handled carefully.',
    copy: 'Choose your service speed, confirm pickup details, and CareNest will keep you updated from pickup to delivery.',
    serviceOptions: [
      ['Normal', '2 - 3 Days', servicePrices.laundry.serviceOptions.Normal],
      ['Express', '24 Hours', servicePrices.laundry.serviceOptions.Express],
    ],
    primaryField: 'clothesType',
    primaryLabel: 'Clothes Type',
    primaryOptions: {
      ...servicePrices.laundry.primaryOptions,
    },
    notePlaceholder: 'E.g. 7 shirts, gate code, special washing instructions...',
  },
  cleaning: {
    label: 'Cleaning',
    title: 'Cleaning Request',
    icon: FiTool,
    heading: 'A cleaner home, booked in minutes.',
    copy: 'Tell us the home size, cleaning type, and arrival time. We will assign a verified cleaner near you.',
    serviceOptions: [
      ['Standard', 'Surface cleaning', servicePrices.cleaning.serviceOptions.Standard],
      ['Deep Clean', 'Detailed cleaning', servicePrices.cleaning.serviceOptions['Deep Clean']],
    ],
    primaryField: 'propertyType',
    primaryLabel: 'Property Type',
    primaryOptions: {
      ...servicePrices.cleaning.primaryOptions,
    },
    notePlaceholder: 'E.g. Bring floor cleaner, focus on kitchen and bathrooms...',
  },
  delivery: {
    label: 'Delivery',
    title: 'Delivery Request',
    icon: FiPackage,
    heading: 'Essentials delivered without the runaround.',
    copy: 'Choose what you need, set pickup and delivery details, and CareNest will coordinate a rider.',
    serviceOptions: [
      ['Standard', 'Same day', servicePrices.delivery.serviceOptions.Standard],
      ['Priority', 'Under 2 hours', servicePrices.delivery.serviceOptions.Priority],
    ],
    primaryField: 'itemType',
    primaryLabel: 'Item Type',
    primaryOptions: {
      ...servicePrices.delivery.primaryOptions,
    },
    notePlaceholder: 'E.g. Shopping list, shop name, recipient phone number...',
  },
}

const serviceSlugs = Object.keys(serviceConfig)

const manualPaymentMethods = {
  'MTN Mobile Money': {
    label: 'MTN Mobile Money',
    number: import.meta.env.VITE_PAYMENT_MTN_NUMBER || phonePlaceholder,
    accountName: import.meta.env.VITE_PAYMENT_MTN_NAME || 'CareNest',
  },
  'Orange Money': {
    label: 'Orange Money',
    number: import.meta.env.VITE_PAYMENT_ORANGE_NUMBER || phonePlaceholder,
    accountName: import.meta.env.VITE_PAYMENT_ORANGE_NAME || 'CareNest',
  },
}

const formatAmount = (amount) => `${amount.toLocaleString()} FCFA`

function parsePaymentMessage(message) {
  const safeMessage = String(message || '')
  const amountMatch = safeMessage.match(/(?:XAF|FCFA|CFA)?\s*([0-9 .,_]{3,})\s*(?:XAF|FCFA|CFA)/i)
  const phoneMatch = safeMessage.match(/(?:\+?237)?\s*6(?:[\s.-]?\d){8}/)
  const transactionMatch = safeMessage.match(/(?:transaction|trans|txn|reference|ref|id|code)\D{0,12}([A-Z0-9-]{5,})/i)
  const amount = amountMatch ? Number(amountMatch[1].replace(/\D/g, '')) : 0
  const senderDigits = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : ''
  const senderPhone = senderDigits.length > 9 ? senderDigits.slice(-9) : senderDigits
  const transactionId = transactionMatch ? transactionMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase() : ''

  return { amount, senderPhone, transactionId }
}

function createPaymentReference(message) {
  const parsed = parsePaymentMessage(message)
  if (parsed.transactionId) return parsed.transactionId
  if (parsed.senderPhone) return parsed.senderPhone
  return String(message || '').trim().slice(0, 80)
}

const formatPlacedAt = (order) => {
  if (order?.createdAtDate) {
    return order.createdAtDate.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return order?.placedAt || 'Just now'
}

const formatPickupDate = (date) => {
  if (!date) return 'Not selected'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatPickupTime = (time) => {
  if (!time) return 'Not selected'
  const [hourValue, minute] = time.split(':').map(Number)
  const suffix = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`
}

const getTimeline = (order) => timelineSteps.map((step, index) => {
  const status = index < order.currentStep ? 'done' : index === order.currentStep ? 'active' : 'pending'
  const detail = index === 0
    ? formatPlacedAt(order)
    : index === 1
      ? `${formatPickupDate(order.pickupDate)}, ${formatPickupTime(order.pickupTime)}`
      : status === 'active'
        ? 'In Progress'
        : status === 'done'
          ? 'Completed'
          : 'Pending'
  return [step, detail, status]
})

const createEmptyForm = (serviceType = 'laundry') => {
  const config = serviceConfig[serviceType] || serviceConfig.laundry
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const pickupDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  return {
    serviceType,
    serviceSpeed: config.serviceOptions[0][0],
    [config.primaryField]: Object.keys(config.primaryOptions)[0],
    address: serviceAddresses[0] || defaultCustomerAddress,
    pickupDate,
    pickupTime: '10:00',
    paymentMethod: 'MTN Mobile Money',
    paymentReference: '',
    paymentReceiptText: '',
    note: '',
  }
}

const addresses = serviceAddresses

function CustomerAppPage() {
  const { profile, setSession, user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isServices = pathname.includes('/services')
  const requestMatch = pathname.match(/\/request\/([^/]+)/)
  const currentServiceType = serviceSlugs.includes(requestMatch?.[1]) ? requestMatch[1] : 'laundry'
  const isRequest = Boolean(requestMatch) || pathname.includes('/laundry-request')
  const isOrder = pathname.includes('/orders')
  const isOrdersIndex = pathname.endsWith('/orders')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [forms, setForms] = useState(() => Object.fromEntries(
    serviceSlugs.map((serviceType) => [serviceType, createEmptyForm(serviceType)]),
  ))
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentOrder, setRecentOrder] = useState(null)
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false)
  const [photoStatus, setPhotoStatus] = useState({ loading: false, error: '', message: '' })

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsCustomerMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    if (!user?.uid) return undefined
    return subscribeToCustomerOrders(
      user.uid,
      (nextOrders) => {
        setOrders(nextOrders)
        setOrdersLoading(false)
      },
      (error) => {
        setRequestError(error.message)
        setOrdersLoading(false)
      },
    )
  }, [user?.uid])

  const activeOrder = useMemo(
    () => orders.find((order) => !['Completed', 'Cancelled'].includes(order.status)) || null,
    [orders],
  )
  const viewedOrderId = pathname.split('/').pop()
  const viewedOrder = orders.find((order) => order.id === viewedOrderId)
    || (recentOrder?.id === viewedOrderId ? recentOrder : null)
  const requestConfig = serviceConfig[currentServiceType]
  const PrimaryIcon = requestConfig.icon
  const form = forms[currentServiceType]
  const primaryValue = form[requestConfig.primaryField] || Object.keys(requestConfig.primaryOptions)[0]
  const selectedOption = requestConfig.serviceOptions.find(([name]) => name === form.serviceSpeed) || requestConfig.serviceOptions[0]
  const requestAmount = requestConfig.primaryOptions[primaryValue] + selectedOption[2]
  const manualPayment = manualPaymentMethods[form.paymentMethod]
  const completedOrders = orders.filter((order) => order.status === 'Completed')
  const customerName = profile?.name || user?.displayName || 'Customer'
  const customerAddress = profile?.address || profile?.area || defaultCustomerCity
  const customerInitials = customerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CU'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const minimumPickupDate = new Date().toISOString().slice(0, 10)

  async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoStatus({ loading: true, error: '', message: '' })
    try {
      const uploaded = await uploadCustomerProfilePhoto(user, file)
      setSession({ ...profile, ...uploaded })
      setPhotoStatus({ loading: false, error: '', message: 'Profile photo updated.' })
    } catch (error) {
      setPhotoStatus({ loading: false, error: error.message, message: '' })
    }
  }

  function updateForm(event) {
    const { name, value } = event.target
    setForms((current) => ({
      ...current,
      [currentServiceType]: {
        ...current[currentServiceType],
        [name]: value,
      },
    }))
    setRequestMessage('')
    setRequestError('')
    setShowReview(false)
  }

  function reviewServiceRequest() {
    setRequestMessage('')
    setRequestError('')
    if (!user?.uid) {
      setRequestError('Please login again before creating a request.')
      return
    }
    if (!form.pickupDate || form.pickupDate < minimumPickupDate) {
      setRequestError('Please choose today or a future service date.')
      return
    }
    if (!form.pickupTime || !form.address) {
      setRequestError('Please select an address, date, and time.')
      return
    }
    if (manualPayment && form.paymentReceiptText.trim().length < 15) {
      setRequestError('Please copy the payment confirmation SMS from MTN or Orange and paste it here.')
      return
    }
    setShowReview(true)
  }

  async function submitServiceRequest() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setRequestError('')
    const requestId = createRequestId()
    const paymentReceiptText = form.paymentReceiptText.trim()
    const parsedPaymentReceipt = parsePaymentMessage(paymentReceiptText)
    const paymentReference = manualPayment ? createPaymentReference(paymentReceiptText) : form.paymentReference.trim()
    const nextOrder = {
      id: requestId,
      customerUid: user.uid,
      customerName: profile?.name || user.displayName || 'Customer',
      customerEmail: user.email,
      customerPhone: profile?.phone || '',
      service: requestConfig.label,
      serviceType: currentServiceType,
      ...form,
      serviceSpeed: selectedOption[0],
      itemSummary: primaryValue,
      amount: requestAmount,
      paymentMethod: form.paymentMethod,
      paymentReference,
      paymentReceiptText,
      paymentReceiptAmount: parsedPaymentReceipt.amount || null,
      paymentReceiptSenderPhone: parsedPaymentReceipt.senderPhone,
      paymentReceiptTransactionId: parsedPaymentReceipt.transactionId,
      paymentReceiverNumber: manualPayment?.number || '',
      paymentReceiverName: manualPayment?.accountName || '',
      paymentStatus: manualPayment ? 'Submitted' : 'Pending',
      status: 'Pending',
      placedAt: 'Just now',
      currentStep: 0,
    }
    try {
      const createdOrder = await createServiceRequest(nextOrder)
      setRecentOrder(createdOrder)
      setForms((current) => ({
        ...current,
        [currentServiceType]: createEmptyForm(currentServiceType),
      }))
      setRequestMessage(`Request ${nextOrder.id} created successfully.`)
      setShowReview(false)
      navigate(`/dashboard/customer/orders/${nextOrder.id}`)
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mobile-app-page">
      <section className={`mobile-phone ${isCustomerMenuOpen ? 'customer-menu-open' : ''}`}>
        {!isServices && !isRequest && !isOrder && (
          <section className="mobile-content mobile-content-home">
            <div className="app-header">
              <button
                className="icon-button"
                type="button"
                aria-label={isCustomerMenuOpen ? 'Close customer menu' : 'Open customer menu'}
                aria-expanded={isCustomerMenuOpen}
                aria-controls="customer-menu"
                onClick={() => setIsCustomerMenuOpen((current) => !current)}
              >
                {isCustomerMenuOpen ? <FiX /> : <FiMenu />}
              </button>
              <Logo to="/dashboard/customer" compact />
              <Link className="icon-button notification-button" to={activeOrder ? `/dashboard/customer/orders/${activeOrder.id}` : '/dashboard/customer/services'} aria-label={activeOrder ? 'View active order' : 'No active-order notifications'}><FiBell />{activeOrder && <span>1</span>}</Link>
              <div className="customer-menu-popover" id="customer-menu">
                <Link to="/dashboard/customer" onClick={() => setIsCustomerMenuOpen(false)}><FiHome />Home</Link>
                <Link to="/dashboard/customer/orders" onClick={() => setIsCustomerMenuOpen(false)}><FiBriefcase />Orders</Link>
                <Link to="/dashboard/customer/services" onClick={() => setIsCustomerMenuOpen(false)}><FiGift />Services</Link>
                <a href={supportPhoneHref} onClick={() => setIsCustomerMenuOpen(false)}><FiPhone />Call CareNest</a>
              </div>
            </div>
            <div className="home-primary">
              <div className="customer-greeting">
                <div>
                  <p>{greeting},</p>
                  <h1>{customerName}</h1>
                  <small><FiMapPin /> {customerAddress}</small>
                </div>
                <label className={`avatar-upload ${photoStatus.loading ? 'uploading' : ''}`} aria-label="Upload profile photo">
                  <span className="avatar">{profile?.photoURL ? <img src={profile.photoURL} alt={`${customerName}'s profile`} /> : customerInitials}</span>
                  <span className="avatar-upload-action"><FiCamera />{photoStatus.loading ? 'Uploading' : 'Photo'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfilePhoto} disabled={photoStatus.loading} />
                </label>
              </div>
              {(photoStatus.error || photoStatus.message) && <p className={`photo-status ${photoStatus.error ? 'error' : ''}`} role="status">{photoStatus.error || photoStatus.message}</p>}
              <div className="mobile-hero">
                <div>
                  <h2>We take care of what matters at home.</h2>
                  <Link to="/dashboard/customer/services">Learn More</Link>
                </div>
                <div className="hero-art hero-art-laundry"><FiShoppingBag /></div>
              </div>
            </div>
            <div className="home-secondary">
              <div className="section-title"><strong>Quick Actions</strong><Link to="/dashboard/customer/services">See all</Link></div>
              <div className="quick-grid">
                {quickActions.map(([label, Icon, to]) => (
                  to.startsWith('tel:')
                    ? <a className={label.includes('Call') ? 'orange-action' : ''} href={to} key={label}><Icon />{label}</a>
                    : <Link to={to} key={label}><Icon />{label}</Link>
                ))}
              </div>
              <div className="section-title"><strong>Your Current Order</strong><Link to="/dashboard/customer/orders">View all</Link></div>
              {activeOrder ? (
                <Link className="order-card" to={`/dashboard/customer/orders/${activeOrder.id}`}>
                  <div className="order-icon"><FiShoppingBag /></div>
                  <div className="order-summary">
                    <strong>{activeOrder.service} Order - {activeOrder.id}</strong>
                    <p>Pickup: {formatPickupDate(activeOrder.pickupDate)}, {formatPickupTime(activeOrder.pickupTime)}</p>
                    <p><b>Details:</b> {activeOrder.note || activeOrder.itemSummary || activeOrder.clothesType}</p>
                  </div>
                  <span>{activeOrder.status}</span>
                  <div className="mini-progress"><i></i><i></i><i></i><i></i></div>
                </Link>
              ) : ordersLoading
                ? <p className="request-message" role="status">Loading your orders…</p>
                : <div className="customer-empty"><FiShoppingBag /><div><strong>No active orders</strong><p>Choose a service and create your first request in a few steps.</p></div><Link to="/dashboard/customer/services">Browse services</Link></div>}
              <div className="section-title"><strong>Recent Activity</strong><Link to="/dashboard/customer/orders">See all</Link></div>
              <div className="activity-list">
                {completedOrders.slice(0, 2).map((order) => (
                  <Link to={`/dashboard/customer/orders/${order.id}`} key={order.id}>
                    {order.service === 'Laundry' ? <FiShoppingBag /> : <FiTool />}
                    <strong>{order.id}</strong>
                    <span>{order.service}</span>
                    <b>{order.status}</b>
                    <small>{formatPlacedAt(order)}<br />{formatAmount(order.amount)}</small>
                  </Link>
                ))}
                {completedOrders.length === 0 && <p className="dashboard-muted-empty">Your completed services will appear here.</p>}
              </div>
            </div>
            <a className="floating-call" href={supportPhoneHref} aria-label="Call CareNest"><FiPhone /></a>
          </section>
        )}

        {isServices && (
          <section className="mobile-content mobile-content-services">
            <div className="services-shell">
              <div className="page-heading">
                <h1>Services</h1>
                <p>Choose a service to get started</p>
              </div>
              <div className="services-grid">
                {services.map(([service, description, tone, startingPrice]) => (
                  <article className={`service-card service-card-${tone}`} key={service}>
                    <div className={`service-art service-art-${tone}`}>
                      {tone === 'laundry' && <FiShoppingBag />}
                      {tone === 'cleaning' && <FiTool />}
                      {tone === 'delivery' && <FiPackage />}
                    </div>
                    <div><h2>{service}</h2><p>{description}</p><strong className="service-price">From {formatAmount(startingPrice)}</strong><Link to={`/dashboard/customer/request/${tone}`}>Book Now <FiArrowRight /></Link></div>
                  </article>
                ))}
              </div>
              <div className="service-support-strip">
                <span><FiCheck /> Verified providers</span>
                <span><FiClock /> Reliable pickup times</span>
                <a href={supportPhoneHref}><FiPhone /> Call CareNest</a>
              </div>
            </div>
          </section>
        )}

        {isRequest && (
          <section className="mobile-content mobile-content-request">
            <div className="request-shell">
              <div className="request-main">
                <div className="top-title"><Link to="/dashboard/customer/services"><FiArrowLeft /></Link><h1>{requestConfig.title}</h1></div>
                <div className="stepper"><span className="active">1<small>Details</small></span><i></i><span>2<small>Pickup</small></span><i></i><span>3<small>Review</small></span></div>
                <strong className="form-section-label">Service Type</strong>
                <div className="request-options">
                  {requestConfig.serviceOptions.map(([speed, detail]) => (
                    <button className={`request-box ${form.serviceSpeed === speed ? 'selected' : ''}`} type="button" onClick={() => setForms((current) => ({ ...current, [currentServiceType]: { ...current[currentServiceType], serviceSpeed: speed } }))} key={speed}>
                      {speed === requestConfig.serviceOptions[0][0] ? <PrimaryIcon /> : <FiZap />}
                      <strong>{speed}</strong>
                      <span>{detail}</span>
                      {form.serviceSpeed === speed && <b><FiCheck /></b>}
                    </button>
                  ))}
                </div>
                <div className="request-field-grid">
                  <label>{requestConfig.primaryLabel}<span className="request-input"><select name={requestConfig.primaryField} value={primaryValue} onChange={updateForm}>{Object.keys(requestConfig.primaryOptions).map((type) => <option key={type} value={type}>{type}</option>)}</select><FiChevronDown /></span></label>
                  <label>{currentServiceType === 'delivery' ? 'Delivery Address' : 'Service Address'}<span className="request-input"><FiMapPin /><select name="address" value={form.address} onChange={updateForm}>{addresses.map((address) => <option key={address} value={address}>{address}</option>)}</select><FiChevronDown /></span></label>
                  <label>{currentServiceType === 'laundry' ? 'Pickup Date' : 'Service Date'}<span className="request-input"><FiCalendar /><input name="pickupDate" type="date" min={minimumPickupDate} value={form.pickupDate} onChange={updateForm} /></span></label>
                  <label>{currentServiceType === 'laundry' ? 'Pickup Time' : 'Service Time'}<span className="request-input"><FiClock /><input name="pickupTime" type="time" value={form.pickupTime} onChange={updateForm} /></span></label>
                  <label>Payment Method<span className="request-input"><select name="paymentMethod" value={form.paymentMethod} onChange={updateForm}><option value="MTN Mobile Money">MTN Mobile Money</option><option value="Orange Money">Orange Money</option><option value="Cash">Cash</option></select><FiChevronDown /></span></label>
                  {manualPayment && (
                    <div className="manual-payment-panel">
                      <div>
                        <span>Send payment to</span>
                        <strong>{manualPayment.number}</strong>
                        <small>{manualPayment.accountName} - {manualPayment.label}</small>
                      </div>
                      <div>
                        <span>Amount</span>
                        <strong>{formatAmount(requestAmount)}</strong>
                        <small>After payment, copy the confirmation SMS and paste it below.</small>
                      </div>
                    </div>
                  )}
                  {manualPayment && (
                    <label className="request-note-field">
                      Paste payment confirmation SMS
                      <textarea
                        className="payment-message-input"
                        name="paymentReceiptText"
                        value={form.paymentReceiptText}
                        onChange={updateForm}
                        placeholder="Paste the full MTN or Orange payment message here."
                      />
                    </label>
                  )}
                  <label className="request-note-field">Additional Note (Optional)<textarea name="note" value={form.note} onChange={updateForm} placeholder={requestConfig.notePlaceholder} /></label>
                </div>
                {requestMessage && <p className="request-message">{requestMessage}</p>}
                {requestError && <p className="request-message request-error" role="alert">{requestError}</p>}
                {showReview && (
                  <section className="booking-review" aria-labelledby="booking-review-title">
                    <div className="booking-review-header"><div><small>Final step</small><h2 id="booking-review-title">Review your request</h2></div><button type="button" onClick={() => setShowReview(false)}>Edit</button></div>
                    <dl>
                      <div><dt>Service</dt><dd>{requestConfig.label} · {selectedOption[0]}</dd></div>
                      <div><dt>Details</dt><dd>{primaryValue}</dd></div>
                      <div><dt>When</dt><dd>{formatPickupDate(form.pickupDate)}, {formatPickupTime(form.pickupTime)}</dd></div>
                      <div><dt>Address</dt><dd>{form.address}</dd></div>
                      <div><dt>Payment</dt><dd>{form.paymentMethod}</dd></div>
                      {manualPayment && <div><dt>Send to</dt><dd>{manualPayment.number}</dd></div>}
                      {manualPayment && <div><dt>Payment message</dt><dd>{form.paymentReceiptText}</dd></div>}
                      <div><dt>Total</dt><dd>{formatAmount(requestAmount)}</dd></div>
                    </dl>
                    <button className="confirm-request" type="button" onClick={submitServiceRequest} disabled={isSubmitting}>{isSubmitting ? 'Creating request…' : 'Confirm and create request'}</button>
                  </section>
                )}
                {!showReview && <div className="request-submit-row">
                  <span><small>Estimated total</small><strong>{formatAmount(requestAmount)}</strong></span>
                  <button type="button" onClick={reviewServiceRequest}>Review request</button>
                </div>}
              </div>
              <div className="request-aside">
                <div className="aside-visual"><PrimaryIcon /></div>
                <h2>{requestConfig.heading}</h2>
                <p>{requestConfig.copy}</p>
                <div className="aside-list">
                  <span><FiCheck /> Pickup reminder</span>
                  <span><FiCheck /> Status tracking</span>
                  <span><FiPhone /> Fast support</span>
                </div>
                <a href={supportPhoneHref}><FiPhone /> Call CareNest</a>
              </div>
            </div>
          </section>
        )}

        {isOrdersIndex && (
          <section className="mobile-content mobile-content-order">
            <div className="orders-history-shell">
              <div className="page-heading"><h1>Your orders</h1><p>Track active requests and review completed services.</p></div>
              {ordersLoading ? <p className="request-message" role="status">Loading your orders…</p> : orders.length > 0 ? (
                <div className="orders-history-grid">
                  {orders.map((order) => (
                    <Link className="order-card" to={`/dashboard/customer/orders/${order.id}`} key={order.firestoreId || order.id}>
                      <div className="order-icon">{order.serviceType === 'delivery' ? <FiPackage /> : order.serviceType === 'cleaning' ? <FiTool /> : <FiShoppingBag />}</div>
                      <div className="order-summary"><strong>{order.service} · {order.id}</strong><p>{formatPlacedAt(order)}</p><p>{formatAmount(order.amount)}</p></div>
                      <span>{order.status}</span>
                    </Link>
                  ))}
                </div>
              ) : <div className="customer-empty"><FiShoppingBag /><div><strong>No orders yet</strong><p>Your service requests will appear here after you book.</p></div><Link to="/dashboard/customer/services">Browse services</Link></div>}
            </div>
          </section>
        )}

        {isOrder && !isOrdersIndex && viewedOrder && (
          <section className="mobile-content mobile-content-order">
            <div className="tracking-shell">
              <div className="tracking-main">
                <div className="top-title"><Link to="/dashboard/customer" aria-label="Back to home"><FiArrowLeft /></Link><h1>Order Tracking</h1></div>
                {requestMessage && <p className="booking-confirmation" role="status"><FiCheck /> {requestMessage}</p>}
                <div className="tracking-hero">
                  <div className="order-machine"><FiShoppingBag /></div>
                  <div><h2>{viewedOrder.service} Order</h2><strong>{viewedOrder.id}</strong><p>Placed on {formatPlacedAt(viewedOrder)}</p><span>{viewedOrder.status}</span></div>
                </div>
                <div className="tracking-steps">
                  {getTimeline(viewedOrder).map(([step, detail, status]) => (
                    <div className={`track-row ${status}`} key={step}><span>{status !== 'pending' && <FiCheck />}</span><div><strong>{step}</strong><p>{detail}</p></div></div>
                  ))}
                </div>
              </div>
              <aside className="tracking-aside">
                <h2>Order summary</h2>
                <div><span>Service</span><strong>{viewedOrder.service}</strong></div>
                <div><span>Pickup</span><strong>{formatPickupDate(viewedOrder.pickupDate)}, {formatPickupTime(viewedOrder.pickupTime)}</strong></div>
                <div><span>Details</span><strong>{viewedOrder.note || viewedOrder.itemSummary || viewedOrder.clothesType}</strong></div>
                <div><span>Payment</span><strong>{viewedOrder.paymentMethod || 'Cash'} - {viewedOrder.paymentStatus || 'Pending'}</strong></div>
                {viewedOrder.paymentReceiverNumber && <div><span>Paid to</span><strong>{viewedOrder.paymentReceiverNumber}</strong></div>}
                {viewedOrder.paymentReference && <div><span>Payment ref</span><strong>{viewedOrder.paymentReference}</strong></div>}
                {viewedOrder.paymentReceiptText && <div><span>Payment message</span><strong>{viewedOrder.paymentReceiptText}</strong></div>}
                <div><span>Amount</span><strong>{formatAmount(viewedOrder.amount)}</strong></div>
                {viewedOrder.providerName && <div><span>Provider</span><strong>{viewedOrder.providerName} · Verified</strong></div>}
                <a className="call-card" href={supportPhoneHref}><div><strong>Need help?</strong><p>Call us for any support</p></div><span><FiPhone /> Call CareNest</span></a>
              </aside>
            </div>
          </section>
        )}

        {isOrder && !isOrdersIndex && !viewedOrder && (
          <section className="mobile-content mobile-content-order">
            <div className="tracking-shell">
              <div className="tracking-main">
                <div className="top-title"><Link to="/dashboard/customer"><FiArrowLeft /></Link><h1>Order Tracking</h1></div>
                <p className="request-message" role="status">{ordersLoading ? 'Loading order details…' : 'This order could not be found. Return home or create a new request.'}</p>
              </div>
            </div>
          </section>
        )}

        <nav className="mobile-tabs">
          <Logo to="/dashboard/customer" className="customer-nav-brand" />
          <div className="customer-nav-links">
            <Link className={!isServices && !isRequest && !isOrder ? 'active' : ''} aria-current={!isServices && !isRequest && !isOrder ? 'page' : undefined} to="/dashboard/customer"><FiHome />Home</Link>
            <Link className={isOrder ? 'active' : ''} aria-current={isOrder ? 'page' : undefined} to="/dashboard/customer/orders"><FiBriefcase />Orders</Link>
            <Link className={isServices || isRequest ? 'active' : ''} aria-current={isServices || isRequest ? 'page' : undefined} to="/dashboard/customer/services"><FiGift />Services</Link>
          </div>
        </nav>
      </section>
    </main>
  )
}

export default CustomerAppPage
