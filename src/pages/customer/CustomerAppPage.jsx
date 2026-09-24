import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCalendar,
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
  FiUserPlus,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n.jsx'
import {
  defaultCustomerAddress,
  defaultCustomerCity,
  getStartingPrice,
  phonePlaceholder,
  availableServiceAddresses,
  servicePrices,
  supportPhoneHref,
} from '../../config/businessConfig'
import { formatMarketplaceAmount, getMarketplaceCategory } from '../../config/marketplaceConfig'
import Logo from '../../components/Logo'
import SiteFooter from '../../components/SiteFooter'
import { confirmCustomerCompletion, createMarketplaceServiceRequest, createRequestId, createServiceRequest, submitCustomerComplaint, subscribeToCustomerOrders } from '../../firebase/orderService'
import { postJson } from '../../utils/networkUtils'
import { inputLimits, sanitizeText } from '../../utils/securityUtils'
import { subscribeToActiveListings } from '../../firebase/marketplaceService'
import { createProviderApplication, subscribeToMyProviderApplications } from '../../firebase/providerApplicationService'
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

const formatAmount = (amount) => `${Number(amount || 0).toLocaleString()} FCFA`

const formatPlacedAt = (order, locale = 'en') => {
  if (order?.createdAtDate) {
    return order.createdAtDate.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return order?.placedAt || 'Just now'
}

const formatPickupDate = (date, locale = 'en') => {
  if (!date) return 'Not selected'
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatPickupTime = (time, locale = 'en') => {
  if (!time) return 'Not selected'
  if (locale === 'fr') return time
  const [hourValue, minute] = time.split(':').map(Number)
  const suffix = hourValue >= 12 ? 'PM' : 'AM'
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`
}

const getTimeline = (order, locale) => timelineSteps.map((step, index) => {
  const status = index < order.currentStep ? 'done' : index === order.currentStep ? 'active' : 'pending'
  const detail = index === 0
    ? formatPlacedAt(order, locale)
    : index === 1
      ? `${formatPickupDate(order.pickupDate, locale)}, ${formatPickupTime(order.pickupTime, locale)}`
      : status === 'active'
        ? 'In Progress'
        : status === 'done'
          ? 'Completed'
          : 'Pending'
  return [order.status === 'Awaiting confirmation' && index === 4 ? 'Awaiting your confirmation' : step, detail, status]
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
    address: availableServiceAddresses[0] || defaultCustomerAddress || defaultCustomerCity,
    pickupDate,
    pickupTime: '10:00',
    paymentMethod: 'Mobile Money',
    paymentReference: '',
    paymentNetwork: '', paymentPhone: null,
    note: '',
  }
}

const addresses = availableServiceAddresses

function CustomerAppPage() {
  const { profile, user } = useAuth()
  const { locale } = useI18n()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isServices = pathname.includes('/services')
  const marketplaceMatch = pathname.match(/\/shop\/([^/]+)/)
  const isMarketplaceRequest = Boolean(marketplaceMatch)
  const requestMatch = pathname.match(/\/request\/([^/]+)/)
  const currentServiceType = serviceSlugs.includes(requestMatch?.[1]) ? requestMatch[1] : 'laundry'
  const isRequest = Boolean(requestMatch) || pathname.includes('/laundry-request')
  const isOrder = pathname.includes('/orders')
  const applicationMatch = pathname.match(/\/apply(?:\/([^/]+))?$/)
  const applicationRole = applicationMatch?.[1]
  const isApplication = pathname.includes('/apply')
  const isOrdersIndex = pathname.endsWith('/orders')
  const [orders, setOrders] = useState([])
  const [marketplaceListings, setMarketplaceListings] = useState([])
  const [marketplaceForm, setMarketplaceForm] = useState(() => ({
    quantity: 1, address: availableServiceAddresses[0] || defaultCustomerAddress || defaultCustomerCity,
    pickupDate: createEmptyForm('delivery').pickupDate, pickupTime: '10:00',
    paymentNetwork: '', paymentPhone: null, note: '', orderType: '', variant: '', returnableContainers: 0, rooms: 1, fabricNotes: '', problem: '',
  }))
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [forms, setForms] = useState(() => Object.fromEntries(
    serviceSlugs.map((serviceType) => [serviceType, createEmptyForm(serviceType)]),
  ))
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(null)
  const [complaintText, setComplaintText] = useState('')
  const [complaintStatus, setComplaintStatus] = useState({ loading: false, error: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentOrder, setRecentOrder] = useState(null)
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false)
  const [providerApplications, setProviderApplications] = useState([])
  const [applicationForm, setApplicationForm] = useState({
    role: 'provider',
    phone: profile?.phone || '',
    services: '',
    area: '',
    experience: '',
    transportType: '',
    dispatchRegion: '',
    shiftAvailability: '',
  })
  const [applicationStatus, setApplicationStatus] = useState({ loading: false, error: '', message: '' })

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

  useEffect(() => {
    if (!user?.uid) return undefined
    return subscribeToMyProviderApplications(
      user.uid,
      setProviderApplications,
      (error) => setApplicationStatus((current) => ({ ...current, error: error.message })),
    )
  }, [user?.uid])

  useEffect(() => subscribeToActiveListings(
    setMarketplaceListings,
    (error) => setRequestError(error.message),
  ), [])

  const activeOrder = useMemo(
    () => orders.find((order) => !['Completed', 'Cancelled'].includes(order.status)) || null,
    [orders],
  )
  const viewedOrderId = pathname.split('/').pop()
  const viewedOrder = orders.find((order) => order.id === viewedOrderId)
    || (recentOrder?.id === viewedOrderId ? recentOrder : null)
  const selectedListing = marketplaceListings.find((listing) => listing.firestoreId === marketplaceMatch?.[1]) || null
  const marketplaceCategory = selectedListing ? getMarketplaceCategory(selectedListing.category) : null
  const marketplaceAmount = selectedListing ? Number(selectedListing.price) * Number(marketplaceForm.quantity || 0) : 0
  const requestConfig = serviceConfig[currentServiceType]
  const PrimaryIcon = requestConfig.icon
  const form = forms[currentServiceType]
  const primaryValue = form[requestConfig.primaryField] || Object.keys(requestConfig.primaryOptions)[0]
  const selectedOption = requestConfig.serviceOptions.find(([name]) => name === form.serviceSpeed) || requestConfig.serviceOptions[0]
  const requestAmount = Number(requestConfig.primaryOptions[primaryValue] || 0) + Number(selectedOption[2] || 0)
  const isMobileMoneyPayment = form.paymentMethod === 'Mobile Money'
  const selectedApplicationRole = ['provider', 'rider'].includes(applicationRole) ? applicationRole : null
  const applicationHeading = selectedApplicationRole
    ? selectedApplicationRole === 'provider'
      ? 'Become a Provider'
      : 'Join as a Rider'
    : 'Apply to work with CareNest'
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

  function updateApplicationForm(event) {
    const { name, value } = event.target
    setApplicationForm((current) => ({ ...current, [name]: sanitizeText(value, inputLimits.description) }))
    setApplicationStatus({ loading: false, error: '', message: '' })
  }

  async function submitApplication(event) {
    event.preventDefault()
    setApplicationStatus({ loading: true, error: '', message: '' })
    try {
      const application = { ...applicationForm, role: selectedApplicationRole || applicationForm.role }
      await createProviderApplication(user, profile, application)
      setApplicationStatus({ loading: false, error: '', message: `Application submitted. CareNest will review it before ${application.role} access is enabled.` })
    } catch (error) {
      setApplicationStatus({ loading: false, error: error.message, message: '' })
    }
  }

  function updateForm(event) {
    const { name, value } = event.target
    const safeValue = sanitizeText(value, name === 'note' ? inputLimits.note : inputLimits.address)
    setForms((current) => ({
      ...current,
      [currentServiceType]: {
        ...current[currentServiceType],
        [name]: safeValue,
      },
    }))
    setRequestMessage('')
    setRequestError('')
  }

  async function submitServiceRequest() {
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
    if (!/^6\d{8}$/.test(String(form.paymentPhone ?? profile?.phone ?? '').replace(/\D/g, '').replace(/^237/, ''))) {
      setRequestError('Enter a valid Cameroon Mobile Money number before saving the order.')
      return
    }
    if (!['mtn', 'orange'].includes(form.paymentNetwork)) {
      setRequestError('Choose MTN MoMo or Orange Money for this payment number.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setRequestError('')
    const requestId = createRequestId()
    const nextOrder = {
      id: requestId,
      customerUid: user.uid,
      customerName: profile?.name || user.displayName || 'Customer',
      customerEmail: user.email,
      service: requestConfig.label,
      serviceType: currentServiceType,
      ...form,
      customerPhone: form.paymentPhone ?? profile?.phone ?? '',
      serviceSpeed: selectedOption[0],
      itemSummary: primaryValue,
      amount: requestAmount,
      paymentMethod: 'Mobile Money',
      paymentReference: '',
      paymentReceiptTransactionId: '',
      paymentReceiptText: '',
      paymentStatus: 'Pending',
      status: 'Pending',
      placedAt: 'Just now',
      currentStep: 0,
    }

    let createdOrder
    try {
      createdOrder = await createServiceRequest(nextOrder)
    } catch (error) {
      setRequestError(error.message)
      setIsSubmitting(false)
      return
    }

    if (isMobileMoneyPayment) {
      if (!nextOrder.customerPhone) {
        setRequestError('Enter the Mobile Money number that should receive the payment prompt.')
        setIsSubmitting(false)
        return
      }
      try {
        await postJson('/api/payments', {
          firestoreId: createdOrder.firestoreId,
        })
      } catch (error) {
        setRecentOrder(createdOrder)
        setRequestError(`Your order was saved. Payment could not start: ${error.message} Check the saved order payment status before trying again.`)
        navigate(`/dashboard/customer/orders/${createdOrder.id}`)
        setIsSubmitting(false)
        return
      }
    }

    setRecentOrder(createdOrder)
    setForms((current) => ({
      ...current,
      [currentServiceType]: createEmptyForm(currentServiceType),
    }))
    setPaymentSuccess({ id: nextOrder.id, amount: nextOrder.amount, phone: nextOrder.customerPhone })
    setIsSubmitting(false)
  }

  function updateMarketplaceForm(event) {
    const { name, value } = event.target
    const safeValue = sanitizeText(value, name === 'note' ? inputLimits.note : inputLimits.address)
    setMarketplaceForm((current) => ({ ...current, [name]: safeValue }))
    setRequestError('')
  }

  async function submitMarketplaceRequest(event) {
    event.preventDefault()
    setRequestError('')
    if (!selectedListing || !marketplaceCategory) {
      setRequestError('This listing is no longer available.')
      return
    }
    const quantity = Number(marketplaceForm.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      setRequestError('Choose a quantity between 1 and 50.')
      return
    }
    if (selectedListing.stockTracked && quantity > Number(selectedListing.stockQuantity || 0)) {
      setRequestError('The provider does not have that quantity in stock.')
      return
    }
    if (!marketplaceForm.address || !marketplaceForm.pickupDate || !marketplaceForm.pickupTime) {
      setRequestError('Enter the delivery address, date, and time.')
      return
    }
    const customerPhone = marketplaceForm.paymentPhone ?? profile?.phone ?? ''
    if (!/^6\d{8}$/.test(String(customerPhone).replace(/\D/g, '').replace(/^237/, ''))) {
      setRequestError('Enter the Mobile Money number that should receive the payment prompt.')
      return
    }
    if (!['mtn', 'orange'].includes(marketplaceForm.paymentNetwork)) {
      setRequestError('Choose MTN MoMo or Orange Money for this payment number.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)

    const nextOrder = {
      id: createRequestId(),
      customerUid: user.uid,
      customerName: profile?.name || user.displayName || 'Customer',
      customerEmail: user.email,
      customerPhone,
      paymentNetwork: marketplaceForm.paymentNetwork,
      service: selectedListing.title,
      serviceType: 'marketplace',
      serviceSpeed: 'Standard',
      itemSummary: selectedListing.title,
      listingCategory: selectedListing.category,
      quantity,
      orderDetails: Object.fromEntries(marketplaceCategory.orderFields.map((field) => [field.name, marketplaceForm[field.name] || ''])),
      address: marketplaceForm.address,
      pickupDate: marketplaceForm.pickupDate,
      pickupTime: marketplaceForm.pickupTime,
      note: marketplaceForm.note,
      amount: marketplaceAmount,
      paymentMethod: 'Mobile Money',
      paymentReference: '',
      paymentReceiptTransactionId: '',
      paymentReceiptText: '',
      paymentStatus: 'Pending',
      status: 'Pending',
      placedAt: 'Just now',
      currentStep: 0,
    }

    let createdOrder
    try {
      createdOrder = await createMarketplaceServiceRequest(nextOrder, selectedListing)
    } catch (error) {
      setRequestError('Marketplace order failed: ' + error.message)
      setIsSubmitting(false)
      return
    }

    try {
      await postJson('/api/payments', {
          firestoreId: createdOrder.firestoreId,
        })

      setRecentOrder(createdOrder)
      setPaymentSuccess({ id: nextOrder.id, amount: nextOrder.amount, phone: nextOrder.customerPhone })
    } catch (error) {
      setRecentOrder(createdOrder)
      setRequestError('Your order was saved. Payment could not start: ' + error.message + ' Check the saved order payment status before trying again.')
      navigate(`/dashboard/customer/orders/${createdOrder.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  const pendingPaymentId = viewedOrder?.firestoreId
  const pendingPaymentReference = viewedOrder?.paymentReference
  const pendingPaymentStatus = viewedOrder?.paymentStatus
  useEffect(() => {
    if (!pendingPaymentId || !pendingPaymentReference || !['Pending', 'Submitted'].includes(pendingPaymentStatus)) return undefined
    let stopped = false
    let attempts = 0
    let timer
    const refresh = async () => {
      if (stopped || attempts >= 6) return
      if (document.visibilityState !== 'hidden') {
        attempts++
        try {
          const result = await postJson('/api/payments', { firestoreId: pendingPaymentId, action: 'verify' })
          if (['Paid', 'Failed', 'Refunded'].includes(result.paymentStatus)) return
        } catch {
          // Keep the manual status button available after a temporary network failure.
        }
      }
      if (!stopped) timer = setTimeout(refresh, 30000)
    }
    timer = setTimeout(refresh, 1000)
    return () => { stopped = true; clearTimeout(timer) }
  }, [pendingPaymentId, pendingPaymentReference, pendingPaymentStatus])

  async function checkOrderPayment() {
    if (!viewedOrder?.firestoreId) return
    setIsSubmitting(true)
    setRequestError('')
    try {
      const result = await postJson('/api/payments', { firestoreId: viewedOrder.firestoreId, action: 'verify' })
      if (result.message) setRequestError(result.message)
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function retryOrderPayment() {
    if (!viewedOrder?.firestoreId || viewedOrder.paymentStatus === 'Paid' || viewedOrder.paymentReference || ['Starting', 'Unknown'].includes(viewedOrder.paymentInitiationState)) return
    if (isSubmitting) return
    setIsSubmitting(true)
    setRequestError('')
    try {
      await postJson('/api/payments', { firestoreId: viewedOrder.firestoreId })
      setPaymentSuccess({ id: viewedOrder.id, amount: viewedOrder.amount, phone: viewedOrder.customerPhone })
    } catch (error) {
      setRequestError('Payment could not start: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmCompletion() {
    if (!viewedOrder?.firestoreId || isSubmitting) return
    if (!window.confirm('Only confirm if the service is complete or you have received your delivery. This makes the provider eligible for payout after payment is verified.')) return
    setIsSubmitting(true)
    setRequestError('')
    try {
      await confirmCustomerCompletion(viewedOrder.firestoreId)
      setRequestMessage('Thank you. You confirmed that this order was completed.')
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitComplaint(event) {
    event.preventDefault()
    if (!viewedOrder?.firestoreId) return
    setComplaintStatus({ loading: true, error: '', message: '' })
    try {
      await submitCustomerComplaint(viewedOrder.firestoreId, complaintText)
      setComplaintText('')
      setComplaintStatus({ loading: false, error: '', message: 'Complaint submitted. CareNest will review it before provider payout.' })
    } catch (error) {
      setComplaintStatus({ loading: false, error: error.message, message: '' })
    }
  }

  return (
    <main className="mobile-app-page">
      <section className={`mobile-phone ${isCustomerMenuOpen ? 'customer-menu-open' : ''}`}>
        {!isServices && !isRequest && !isMarketplaceRequest && !isOrder && !isApplication && (
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
                <Link to="/dashboard/customer/apply" onClick={() => setIsCustomerMenuOpen(false)}><FiUserPlus />Apply to work</Link>
                <Link to="/support" onClick={() => setIsCustomerMenuOpen(false)}>Help &amp; support</Link>
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
                <div className="avatar-display" aria-label="Profile initials">
                  <span className="avatar">{customerInitials}</span>
                </div>
              </div>
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
                    <p>Pickup: {formatPickupDate(activeOrder.pickupDate, locale)}, {formatPickupTime(activeOrder.pickupTime, locale)}</p>
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
                    <small>{formatPlacedAt(order, locale)}<br />{formatAmount(order.amount)}</small>
                  </Link>
                ))}
                {completedOrders.length === 0 && <p className="dashboard-muted-empty">Your completed services will appear here.</p>}
              </div>
            </div>

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
              <div className="marketplace-section-heading">
                <div><span>Local marketplace</span><h2>Provider storefronts</h2></div>
                <p>Order directly from verified home-essential shops and service businesses.</p>
              </div>
              <div className="marketplace-customer-grid">
                {marketplaceListings.map((listing) => (
                  <article className="marketplace-customer-card" key={listing.firestoreId}>
                    <span>{getMarketplaceCategory(listing.category).label}</span>
                    <h3>{listing.title}</h3>
                    <p>{listing.description}</p>
                    <small>Sold by {listing.providerName} · {listing.serviceArea}</small>
                    {listing.turnaround && <small>{listing.turnaround}</small>}
                    <strong>{formatMarketplaceAmount(listing.price)} / {listing.unit}</strong>
                    {listing.stockTracked && <small>{listing.stockQuantity > 0 ? listing.stockQuantity + ' available' : 'Out of stock'}</small>}
                    <Link className={listing.stockTracked && listing.stockQuantity < 1 ? 'disabled' : ''} aria-disabled={listing.stockTracked && listing.stockQuantity < 1} to={'/dashboard/customer/shop/' + listing.firestoreId}>View and order <FiArrowRight /></Link>
                  </article>
                ))}
                {marketplaceListings.length === 0 && <div className="marketplace-empty"><FiShoppingBag /><strong>Provider shops are coming soon</strong><p>Approved providers can publish products and services from their dashboard.</p></div>}
              </div>              <div className="service-support-strip">
                <span><FiCheck /> Verified providers</span>
                <span><FiClock /> Reliable pickup times</span>
                <a href={supportPhoneHref}><FiPhone /> Call CareNest</a>
              </div>
            </div>
          </section>
        )}

        {isApplication && (
          <section className="mobile-content provider-application-page">
            <div className="provider-application-shell">
              <div className="top-title"><Link to="/dashboard/customer" aria-label="Back to home"><FiArrowLeft /></Link><h1>{applicationHeading}</h1></div>
              <div className="provider-application-intro">
                <FiUserPlus />
                <div>
                  <h2>{selectedApplicationRole ? (selectedApplicationRole === 'provider' ? 'Work with customers as a verified provider.' : 'Deliver orders and handle pickups.') : 'Choose how you want to work with CareNest.'}</h2>
                  <p>{selectedApplicationRole ? (selectedApplicationRole === 'provider' ? 'Tell us about your services, location, and experience. The CareNest team reviews every application before approval.' : 'Tell us about your delivery experience, transport, and availability.') : 'Select a role below to begin your application.'}</p>
                </div>
              </div>

              {!selectedApplicationRole ? (
                <div className="application-role-selector">
                  <button type="button" className="application-role-card" onClick={() => navigate('/dashboard/customer/apply/provider')}>
                    <FiUserPlus /><strong>Provider</strong><span>Serve customers directly with home services.</span>
                  </button>
                  <button type="button" className="application-role-card" onClick={() => navigate('/dashboard/customer/apply/rider')}>
                    <FiPackage /><strong>Rider</strong><span>Pick up and deliver orders between customers and providers.</span>
                  </button>
                </div>
              ) : (
                <>
                  {providerApplications[0] && (
                    <div className={`provider-application-state status-${providerApplications[0].status.toLowerCase()}`}>
                      <span>Current application</span><strong>{providerApplications[0].status}</strong>
                      <p>{providerApplications[0].status === 'Pending' ? 'Your application is waiting for admin review.' : providerApplications[0].status === 'Approved' ? 'You have been approved. Your dashboard will open automatically once account access is enabled.' : 'You may update the information below and apply again.'}</p>
                    </div>
                  )}
                  {providerApplications[0]?.status !== 'Approved' && providerApplications[0]?.status !== 'Pending' && (
                    <form className="provider-application-form" onSubmit={submitApplication}>
                      <input type="hidden" name="role" value={applicationForm.role} />
                      <label>Telephone number<input name="phone" type="tel" maxLength="20" value={applicationForm.phone} onChange={updateApplicationForm} placeholder={phonePlaceholder} required /></label>
                      {selectedApplicationRole === 'provider' && (
                        <>
                          <label>Services you can provide<input name="services" maxLength="240" value={applicationForm.services} onChange={updateApplicationForm} placeholder="Laundry, cleaning, delivery…" required /></label>
                          <label>Area where you can work<input name="area" maxLength="240" value={applicationForm.area} onChange={updateApplicationForm} placeholder="Town, neighbourhood or service area" required /></label>
                          <label>Your experience<textarea name="experience" maxLength="2000" value={applicationForm.experience} onChange={updateApplicationForm} placeholder="Describe your experience, equipment and availability." minLength="20" required /></label>
                        </>
                      )}
                      {selectedApplicationRole === 'rider' && (
                        <>
                          <label>Transport type<input name="transportType" maxLength="120" value={applicationForm.transportType} onChange={updateApplicationForm} placeholder="Motorbike, bicycle, car…" required /></label>
                          <label>Service area<input name="area" maxLength="240" value={applicationForm.area} onChange={updateApplicationForm} placeholder="Town, neighbourhood or route" required /></label>
                          <label>Experience<textarea name="experience" maxLength="2000" value={applicationForm.experience} onChange={updateApplicationForm} placeholder="Describe your delivery experience, routes, and schedule." minLength="20" required /></label>
                        </>
                      )}
                      {applicationStatus.error && <p className="request-message request-error" role="alert">{applicationStatus.error}</p>}
                      {applicationStatus.message && <p className="request-message" role="status">{applicationStatus.message}</p>}
                      <button type="submit" disabled={applicationStatus.loading}>{applicationStatus.loading ? 'Submitting…' : 'Submit application'}</button>
                    </form>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {isMarketplaceRequest && (
          <section className="mobile-content mobile-content-request marketplace-checkout-page">
            <div className="request-shell">
              {selectedListing ? (
                <>
                  <form className="request-main" onSubmit={submitMarketplaceRequest}>
                    <div className="top-title"><Link to="/dashboard/customer/services"><FiArrowLeft /></Link><h1>{selectedListing.title}</h1></div>
                    <div className="marketplace-seller-line"><FiCheck /><span>Verified provider</span><strong>{selectedListing.providerName}</strong></div>
                    <p>{selectedListing.description}</p>
                    <div className="request-field-grid">
                      {marketplaceCategory.orderFields.map((field) => (
                        <label key={field.name}>{field.label}
                          {field.type === 'select' || (field.type === 'listing-options' && selectedListing.options?.length > 0) ? (
                            <span className="request-input"><select name={field.name} value={marketplaceForm[field.name]} onChange={updateMarketplaceForm} required>
                              <option value="">Choose an option</option>
                              {(field.type === 'listing-options' ? selectedListing.options : field.options).map((option) => <option key={option} value={option}>{option}</option>)}
                            </select><FiChevronDown /></span>
                          ) : field.type === 'textarea' ? (
                            <textarea name={field.name} value={marketplaceForm[field.name]} onChange={updateMarketplaceForm} required />
                          ) : (
                            <span className="request-input"><input name={field.name} type={field.type === 'number' ? 'number' : 'text'} min={field.min} value={marketplaceForm[field.name]} onChange={updateMarketplaceForm} required /></span>
                          )}
                        </label>
                      ))}
                      <label>Quantity<span className="request-input"><input name="quantity" type="number" min="1" max={selectedListing.stockTracked ? Math.min(50, selectedListing.stockQuantity) : 50} value={marketplaceForm.quantity} onChange={updateMarketplaceForm} required /></span></label>
                      <label>{marketplaceCategory.kind === 'product' ? 'Delivery address' : 'Service address'}<span className="request-input"><FiMapPin /><input name="address" maxLength="240" value={marketplaceForm.address} onChange={updateMarketplaceForm} required /></span></label>
                      <label>{marketplaceCategory.kind === 'product' ? 'Delivery date' : 'Service date'}<span className="request-input"><FiCalendar /><input name="pickupDate" type="date" min={minimumPickupDate} value={marketplaceForm.pickupDate} onChange={updateMarketplaceForm} required /></span></label>
                      <label>Preferred time<span className="request-input"><FiClock /><input name="pickupTime" type="time" value={marketplaceForm.pickupTime} onChange={updateMarketplaceForm} required /></span></label>
                      <label>Payment network<span className="request-input"><select name="paymentNetwork" value={marketplaceForm.paymentNetwork} onChange={updateMarketplaceForm} required><option value="">Choose your network</option><option value="mtn">MTN MoMo</option><option value="orange">Orange Money</option></select><FiChevronDown /></span></label>
                  <label>Mobile Money number<span className="request-input"><FiPhone /><input name="paymentPhone" type="tel" maxLength="20" value={marketplaceForm.paymentPhone ?? profile?.phone ?? ''} onChange={updateMarketplaceForm} placeholder={phonePlaceholder} required /></span></label>
                      <p className="payment-phone-preview"><span>The approval request will be sent to:</span> <strong data-no-translate>{marketplaceForm.paymentPhone ?? profile?.phone ?? ''}</strong></p>
                      <label className="request-note-field">Instructions<textarea name="note" maxLength="1000" value={marketplaceForm.note} onChange={updateMarketplaceForm} placeholder="Delivery directions, preferences, or other details…" /></label>
                    </div>
                    {requestError && <p className="request-message request-error" role="alert">{requestError}</p>}
                    <div className="request-submit-row">
                      <span><small>{formatMarketplaceAmount(selectedListing.price)} × {marketplaceForm.quantity || 0}</small><strong>{formatMarketplaceAmount(marketplaceAmount)}</strong></span>
                      <button type="submit" disabled={isSubmitting || (selectedListing.stockTracked && selectedListing.stockQuantity < 1)}>{isSubmitting ? 'Processing…' : 'Pay and order'}</button>
                    </div>
                  </form>
                  <aside className="request-aside">
                    <div className="aside-visual"><FiShoppingBag /></div>
                    <h2>{getMarketplaceCategory(selectedListing.category).label}</h2>
                    <p>Provided by {selectedListing.providerName} in {selectedListing.serviceArea}.</p>
                    <div className="aside-list">
                      <span><FiCheck /> Verified provider</span>
                      <span><FiClock /> {selectedListing.turnaround || 'Provider confirms timing'}</span>
                      <span><FiCheck /> Order tracking included</span>
                    </div>
                  </aside>
                </>
              ) : <div className="marketplace-empty"><FiShoppingBag /><strong>Listing unavailable</strong><p>It may have been hidden or removed by the provider.</p><Link to="/dashboard/customer/services">Back to services</Link></div>}
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
                  <label>{currentServiceType === 'delivery' ? 'Delivery Address' : 'Service Address'}<span className="request-input"><FiMapPin /><input name="address" type="text" maxLength="240" list="service-addresses" value={form.address} onChange={updateForm} placeholder="Enter your pickup or service address" required /></span><datalist id="service-addresses">{addresses.map((address) => <option key={address} value={address} />)}</datalist></label>
                  <label>{currentServiceType === 'laundry' ? 'Pickup Date' : 'Service Date'}<span className="request-input"><FiCalendar /><input name="pickupDate" type="date" min={minimumPickupDate} value={form.pickupDate} onChange={updateForm} /></span></label>
                  <label>{currentServiceType === 'laundry' ? 'Pickup Time' : 'Service Time'}<span className="request-input"><FiClock /><input name="pickupTime" type="time" value={form.pickupTime} onChange={updateForm} /></span></label>
                  <label>Payment network<span className="request-input"><select name="paymentNetwork" value={form.paymentNetwork} onChange={updateForm} required><option value="">Choose your network</option><option value="mtn">MTN MoMo</option><option value="orange">Orange Money</option></select><FiChevronDown /></span></label>
                  <label>Mobile Money Number<span className="request-input"><FiPhone /><input name="paymentPhone" type="tel" maxLength="20" value={form.paymentPhone ?? profile?.phone ?? ''} onChange={updateForm} placeholder={phonePlaceholder} required /></span></label>
                      <p className="payment-phone-preview"><span>The approval request will be sent to:</span> <strong data-no-translate>{form.paymentPhone ?? profile?.phone ?? ''}</strong></p>
                  <div className="manual-payment-panel">
                    <div>
                      <span>Secure Mobile Money</span>
                      <strong>MTN MoMo and Orange Money</strong>
                      <div className="payment-network-badges" aria-label="Supported payment networks">
                        <b className="payment-network-mtn">MTN MoMo</b>
                        <b className="payment-network-orange">Orange Money</b>
                      </div>
                      <small>Enter your number and approve the prompt on your phone. Confirmation is automatic.</small>
                    </div>
                  </div>
                  <label className="request-note-field">Additional Note (Optional)<textarea name="note" maxLength="1000" value={form.note} onChange={updateForm} placeholder={requestConfig.notePlaceholder} /></label>
                </div>
                {requestMessage && <p className="request-message">{requestMessage}</p>}
                {requestError && <p className="request-message request-error" role="alert">{requestError}</p>}
                <div className="request-submit-row">
                  <span><small>Estimated total</small><strong>{formatAmount(requestAmount)}</strong></span>
                  <button type="button" onClick={submitServiceRequest} disabled={isSubmitting}>{isSubmitting ? 'Processing…' : 'Pay'}</button>
                </div>
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
                      <div className="order-summary"><strong>{order.service} · {order.id}</strong><p>{formatPlacedAt(order, locale)}</p><p>{formatAmount(order.amount)}</p></div>
                      <span>{order.status}<br />Payment: {order.paymentStatus || 'Pending'}</span>
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
                  <div><h2>{viewedOrder.service} Order</h2><strong>{viewedOrder.id}</strong><p>Placed on {formatPlacedAt(viewedOrder, locale)}</p><span>{viewedOrder.status}</span></div>
                </div>
                <div className="tracking-steps">
                  {getTimeline(viewedOrder, locale).map(([step, detail, status]) => (
                    <div className={`track-row ${status}`} key={step}><span>{status !== 'pending' && <FiCheck />}</span><div><strong>{step}</strong><p>{detail}</p></div></div>
                  ))}
                </div>
              </div>
              <aside className="tracking-aside">
                <h2>Order summary</h2>
                <div><span>Service</span><strong>{viewedOrder.service}</strong></div>
                <div><span>Pickup</span><strong>{formatPickupDate(viewedOrder.pickupDate, locale)}, {formatPickupTime(viewedOrder.pickupTime, locale)}</strong></div>
                <div><span>Details</span><strong>{viewedOrder.note || viewedOrder.itemSummary || viewedOrder.clothesType}</strong></div>
                <div><span>Payment</span><strong>Mobile Money - {viewedOrder.paymentStatus || 'Pending'}</strong></div>
                {!viewedOrder.paymentReference && !['Starting', 'Unknown'].includes(viewedOrder.paymentInitiationState) && ['Pending', 'Failed'].includes(viewedOrder.paymentStatus || 'Pending') && <p>Your order is saved. Select Retry payment to receive a Mobile Money prompt for this order, then approve it on your phone.</p>}
                {viewedOrder.paymentReference && !['Paid', 'Failed', 'Refunded'].includes(viewedOrder.paymentStatus) && <p>A payment request already exists. Check your phone for the Mobile Money prompt. If it failed or you received no prompt, contact CareNest with this order number before paying again.</p>}
                {requestError && <p className="request-error" role="alert">{requestError}</p>}
                {['Pending', 'Failed'].includes(viewedOrder.paymentStatus || 'Pending') && !viewedOrder.paymentReference && !['Starting', 'Unknown'].includes(viewedOrder.paymentInitiationState) && !['Cancelled', 'Complaint', 'Completed'].includes(viewedOrder.status) && <button className="payment-retry-button" type="button" disabled={isSubmitting} onClick={retryOrderPayment}>{isSubmitting ? 'Starting payment…' : 'Retry payment'}</button>}
                {['Starting', 'Unknown'].includes(viewedOrder.paymentInitiationState) && <p>Your previous payment is awaiting verification. Check its status or contact support before paying again.</p>}
                {viewedOrder.paymentStatus !== 'Paid' && (viewedOrder.paymentReference || ['Starting', 'Unknown'].includes(viewedOrder.paymentInitiationState)) && <button className="payment-retry-button" type="button" disabled={isSubmitting} onClick={checkOrderPayment}>{isSubmitting ? 'Checking...' : 'Check payment status'}</button>}
                {viewedOrder.paymentStatus === 'Failed' && viewedOrder.paymentReference && <p>The payment provider reports that this request failed. If no approval prompt appeared, contact CareNest support with this order number and your Mobile Money network. Do not approve an older prompt or pay again until support has checked the transaction.</p>}
                {viewedOrder.paymentReceiverNumber && <div><span>Paid to</span><strong>{viewedOrder.paymentReceiverNumber}</strong></div>}
                {viewedOrder.paymentReference && <div><span>Payment ref</span><strong>{viewedOrder.paymentReference}</strong></div>}
                {viewedOrder.paymentReceiptText && <div><span>Payment message</span><strong>{viewedOrder.paymentReceiptText}</strong></div>}
                <div><span>Amount</span><strong>{formatAmount(viewedOrder.amount)}</strong></div>
                {viewedOrder.providerName && <div><span>Provider</span><strong>{viewedOrder.providerName} · Verified</strong></div>}
                {['Awaiting confirmation', 'Completed'].includes(viewedOrder.status) && !viewedOrder.completionConfirmedBy && <section className="completion-confirmation">
                  <h3>Was your order completed?</h3>
                  <p>The provider or rider reported completion. Confirm only if you received the service or delivery. Their payout stays blocked until you confirm.</p>
                  <button className="payment-retry-button" type="button" disabled={isSubmitting} onClick={confirmCompletion}>{isSubmitting ? 'Confirming...' : 'Yes, confirm completion'}</button>
                  <a href="#order-complaint">No, report a problem</a>
                </section>}
                {viewedOrder.completionConfirmedBy && <p>You confirmed completion of this order.</p>}
                {viewedOrder.completionProofText && <div><span>Completion note</span><strong>{viewedOrder.completionProofText}</strong></div>}
                {viewedOrder.status !== 'Complaint' && !['Cancelled'].includes(viewedOrder.status) && (
                  <form id="order-complaint" className="customer-complaint-form" onSubmit={submitComplaint}>
                    <label>Report a problem<textarea maxLength="2000" value={complaintText} onChange={(event) => setComplaintText(event.target.value)} placeholder="Describe what went wrong with this service." /></label>
                    {complaintStatus.error && <small className="error" role="alert">{complaintStatus.error}</small>}
                    {complaintStatus.message && <small role="status">{complaintStatus.message}</small>}
                    <button type="submit" disabled={complaintStatus.loading}>{complaintStatus.loading ? 'Submitting…' : 'Submit complaint'}</button>
                  </form>
                )}
                {viewedOrder.status === 'Complaint' && <div><span>Complaint</span><strong>{viewedOrder.complaintText || 'Under review by CareNest.'}</strong></div>}
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

        {paymentSuccess && (
          <div className="payment-success-backdrop" role="presentation">
            <section className="payment-success-modal" role="dialog" aria-modal="true" aria-labelledby="payment-success-title">
              <button className="payment-success-close" type="button" onClick={() => setPaymentSuccess(null)} aria-label="Close payment confirmation"><FiX /></button>
              <span className="payment-success-icon"><FiCheck /></span>
              <h2 id="payment-success-title">Payment request sent</h2>
              <p>Approve the Mobile Money prompt on your phone. CareNest will show Paid only after the payment provider is verified by our server.</p>
              <p>Approval phone: <strong>{paymentSuccess.phone}</strong>. The prompt appears on that phone, which may be different from the device you are using now.</p>
              <small>Request {paymentSuccess.id}</small>
              <button type="button" onClick={() => { setPaymentSuccess(null); navigate(`/dashboard/customer/orders/${paymentSuccess.id}`) }}>View order</button>
            </section>
          </div>
        )}

        <SiteFooter />
        <nav className="mobile-tabs">
          <Logo to="/dashboard/customer" className="customer-nav-brand" />
          <div className="customer-nav-links">
            <Link className={!isServices && !isRequest && !isMarketplaceRequest && !isOrder && !isApplication ? 'active' : ''} aria-current={!isServices && !isRequest && !isMarketplaceRequest && !isOrder && !isApplication ? 'page' : undefined} to="/dashboard/customer"><FiHome />Home</Link>
            <Link className={isOrder ? 'active' : ''} aria-current={isOrder ? 'page' : undefined} to="/dashboard/customer/orders"><FiBriefcase />Orders</Link>
            <Link className={isServices || isRequest || isMarketplaceRequest ? 'active' : ''} aria-current={isServices || isRequest || isMarketplaceRequest ? 'page' : undefined} to="/dashboard/customer/services"><FiGift />Services</Link>
            <Link className={isApplication ? 'active' : ''} aria-current={isApplication ? 'page' : undefined} to="/dashboard/customer/apply"><FiUserPlus />Apply</Link>
          </div>
        </nav>
      </section>
    </main>
  )
}

export default CustomerAppPage
