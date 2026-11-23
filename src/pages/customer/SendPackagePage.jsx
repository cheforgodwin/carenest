import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheck, FiMapPin, FiPackage } from 'react-icons/fi'
import GooglePlacePicker from '../../components/GooglePlacePicker'
import GoogleMapCanvas from '../../components/GoogleMapCanvas'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../firebase/firebaseConfig'
import {
  normalizePeerDeliveryForMap,
  notifyPeerDeliveryUpdate,
  requestPeerDelivery,
  subscribeToMyPeerDeliveries,
} from '../../firebase/peerDeliveryService'
import './SendPackagePage.css'

const steps = ['Locations', 'Recipient', 'Package', 'Review']
const emptyLocation = { address: '', placeId: '', coordinates: null, landmark: '', instructions: '' }
const categories = ['Documents', 'Clothing', 'Electronics', 'Permitted food', 'Household items', 'Personal belongings', 'Other permitted items']

function packagePayload(locations, recipient, packageInfo, phone) {
  return {
    senderPhone: phone,
    recipientPhone: recipient.phone,
    recipientEmail: recipient.email.trim().toLowerCase(),
    recipientName: recipient.name,
    pickup: { placeId: locations.pickup.placeId, landmark: locations.pickup.landmark, instructions: locations.pickup.instructions },
    destination: { placeId: locations.destination.placeId, landmark: locations.destination.landmark, instructions: locations.destination.instructions },
    category: packageInfo.category,
    description: packageInfo.description,
    weightKg: packageInfo.weight,
    quantity: packageInfo.quantity,
    lengthCm: packageInfo.length,
    widthCm: packageInfo.width,
    heightCm: packageInfo.height,
    declaredValue: packageInfo.declaredValue,
    payer: packageInfo.payer,
    permitted: packageInfo.permitted,
  }
}

function statusLabel(status) {
  return String(status || 'Pending').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SendPackagePage({ profile, user }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const invitationToken = searchParams.get('invite') || ''
  const requestedDeliveryId = searchParams.get('delivery') || ''
  const [step, setStep] = useState(0)
  const [locations, setLocations] = useState({ pickup: { ...emptyLocation }, destination: { ...emptyLocation } })
  const [recipient, setRecipient] = useState({ phone: '', email: '', name: '' })
  const [packageInfo, setPackageInfo] = useState({ category: '', description: '', weight: '', length: '', width: '', height: '', declaredValue: '', quantity: '1', permitted: false, payer: '' })
  const [packagePhotos, setPackagePhotos] = useState([])
  const verifiedPhone = user?.phoneNumber || ''
  const [quote, setQuote] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [deliveryLoadError, setDeliveryLoadError] = useState('')
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [paymentPhones, setPaymentPhones] = useState({})
  const [paymentBusyId, setPaymentBusyId] = useState('')
  const [inviteBusyId, setInviteBusyId] = useState('')
  const [createdDelivery, setCreatedDelivery] = useState(null)
  const [invitationUrls, setInvitationUrls] = useState({})

  useEffect(() => {
    if (invitationToken) return undefined
    return subscribeToMyPeerDeliveries(
      (nextDeliveries) => { setDeliveries(nextDeliveries); setDeliveryLoadError('') },
      (nextError) => setDeliveryLoadError(nextError.message || 'Could not load your package requests.'),
    )
  }, [invitationToken])

  function updateLocation(key, changes) {
    setLocations((current) => ({ ...current, [key]: { ...current[key], ...changes } }))
    setQuote(null)
  }

  function continueFlow() {
    setError('')
    if (step === 0 && (!locations.pickup.placeId || !locations.destination.placeId)) {
      setError('Choose both pickup and destination from the Google Maps search results.')
      return
    }
    if (step === 1) {
      if (!/^\+?237\s?6\d{2}[\s-]?\d{3}[\s-]?\d{3}$/.test(recipient.phone.trim())) {
        setError('Enter a valid Cameroon mobile number for the recipient.')
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email.trim())) {
        setError('Enter the recipient’s CareNest email address.')
        return
      }
      if (recipient.email.trim().toLowerCase() === String(user?.email || '').toLowerCase()) {
        setError('The recipient email must be different from yours.')
        return
      }
      if (!verifiedPhone) {
        setError('Add a verified phone number to your CareNest account before creating a delivery.')
        return
      }
    }
    if (step === 2 && (!packageInfo.category || packageInfo.description.trim().length < 3 || !packageInfo.permitted || !packageInfo.payer)) {
      setError('Complete the package details, select who pays, and confirm the prohibited-items policy.')
      return
    }
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }

  async function getQuote() {
    setQuoteBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await requestPeerDelivery({ action: 'quote', ...packagePayload(locations, recipient, packageInfo, verifiedPhone) })
      setQuote(result.quote)
    } catch (quoteError) {
      setError(quoteError.message || 'A secure quote could not be calculated.')
    } finally {
      setQuoteBusy(false)
    }
  }

  async function createRequest() {
    setSubmitBusy(true)
    setError('')
    setMessage('')
    try {
      const photoUrls = await Promise.all(packagePhotos.map(async (file) => {
        const name = `${globalThis.crypto?.randomUUID?.() || Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const photoRef = ref(storage, `peerDeliveryPhotos/${user.uid}/${name}`)
        await uploadBytes(photoRef, file, { contentType: file.type })
        return getDownloadURL(photoRef)
      }))
      const result = await requestPeerDelivery({ action: 'create', ...packagePayload(locations, recipient, packageInfo, verifiedPhone), packagePhotoUrls: photoUrls })
      const delivery = normalizePeerDeliveryForMap(result.delivery)
      const invitationLink = window.location.origin + result.invitationPath
      setInvitationUrls((current) => ({ ...current, [delivery.firestoreId]: invitationLink }))
      setCreatedDelivery(delivery)
      setQuote(result.delivery.pricing)
      const currentDelivery = { ...delivery, currentUserRole: 'sender', canPay: packageInfo.payer === 'sender' }
      setDeliveries((current) => [currentDelivery, ...current.filter((item) => item.firestoreId !== delivery.firestoreId)])
      notifyPeerDeliveryUpdate()
      setMessage(`Request ${delivery.id} created. No payment has been taken; the recipient must accept first.`)
    } catch (submitError) {
      setError(submitError.message || 'The package request could not be created.')
    } finally {
      setSubmitBusy(false)
    }
  }

  async function acceptInvitation() {
    if (!verifiedPhone) {
      setError('Verify the phone number on your CareNest account before accepting.')
      return
    }
    setAcceptBusy(true)
    setError('')
    try {
      const result = await requestPeerDelivery({ action: 'accept', token: invitationToken })
      notifyPeerDeliveryUpdate()
      navigate(`/dashboard/customer/package?delivery=${encodeURIComponent(result.delivery.id)}`, { replace: true })
      setMessage('Invitation accepted. Review the delivery fee and complete payment if you are the designated payer.')
    } catch (acceptError) {
      setError(acceptError.message || 'This invitation could not be accepted.')
    } finally {
      setAcceptBusy(false)
    }
  }

  async function shareInvitation(delivery) {
    setInviteBusyId(delivery.firestoreId)
    setError('')
    let invitationLink = invitationUrls[delivery.firestoreId]
    try {
      if (!invitationLink) {
        const result = await requestPeerDelivery({ action: 'invite', deliveryId: delivery.id })
        invitationLink = window.location.origin + result.invitationPath
        setInvitationUrls((current) => ({ ...current, [delivery.firestoreId]: invitationLink }))
      }
    } catch (shareError) {
      setError(shareError.message || 'An invitation link could not be created.')
      setInviteBusyId('')
      return
    }
    if (!invitationLink) {
      setError('The invitation link could not be loaded. Try again.')
      setInviteBusyId('')
      return
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CareNest package delivery invitation', text: 'Accept this CareNest delivery request after signing in with the invited phone number.', url: invitationLink })
        return
      }
      await navigator.clipboard.writeText(invitationLink)
      setMessage('Invitation link copied. Share it directly with the recipient.')
    } catch (shareError) {
      if (shareError.name === 'AbortError') return
      setMessage('Select and copy the invitation link shown in this delivery card.')
    } finally {
      setInviteBusyId('')
    }
  }

  async function startPayment(delivery, verifyOnly = false) {
    setPaymentBusyId(delivery.firestoreId)
    setError('')
    setMessage('')
    try {
      const action = verifyOnly ? 'verifyPayment' : 'startPayment'
      const paymentPhone = paymentPhones[delivery.firestoreId] || verifiedPhone || profile?.phone || ''
      const result = await requestPeerDelivery({
        action,
        deliveryId: delivery.id,
        ...(verifyOnly ? {} : { paymentPhone }),
      })
      if (result.message) setMessage(result.message)
      else setMessage(`Payment status: ${statusLabel(result.paymentStatus)}.`)
      notifyPeerDeliveryUpdate()
    } catch (paymentError) {
      setError(paymentError.message || 'The payment request could not be completed.')
    } finally {
      setPaymentBusyId('')
    }
  }

  async function cancelDelivery(delivery) {
    setPaymentBusyId(delivery.firestoreId)
    setError('')
    setMessage('')
    try {
      await requestPeerDelivery({ action: 'cancel', deliveryId: delivery.id })
      setMessage(`${delivery.id} cancelled.`)
      notifyPeerDeliveryUpdate()
    } catch (cancelError) {
      setError(cancelError.message || 'This request could not be cancelled.')
    } finally {
      setPaymentBusyId('')
    }
  }

  if (invitationToken) {
    return (
      <section className="mobile-content send-package-page">
        <header className="send-package-header"><Link to="/dashboard/customer" aria-label="Back to home"><FiArrowLeft /></Link><div><span>SECURE INVITATION</span><h1>Accept a package</h1></div><span className="send-package-icon"><FiPackage /></span></header>
        <div className="package-form-panel">
          <h2>Review your package invitation</h2>
          <p>Sign in to the CareNest account that matches the email and phone entered by the sender. You’ll see the package and fee before deciding whether to accept. No SMS code is needed.</p>
          {verifiedPhone && <p className="package-verified-phone"><FiCheck /> Signed in phone: {verifiedPhone}</p>}
          <button type="button" className="package-continue-button" disabled={acceptBusy} onClick={acceptInvitation}>{acceptBusy ? 'Checking invitation...' : 'Accept and view delivery'} <FiArrowRight /></button>
        </div>
        {error && <p className="package-form-message" role="alert">{error}</p>}
      </section>
    )
  }

  const senderName = profile?.name || user?.displayName || 'Your CareNest account'
  const displayedDeliveries = requestedDeliveryId
    ? deliveries.filter((delivery) => delivery.id === requestedDeliveryId)
    : deliveries
  const trackedDelivery = displayedDeliveries.find((delivery) => !['delivered', 'cancelled', 'declined', 'failed_delivery'].includes(String(delivery.status || '').toLowerCase()))

  return (
    <section className="mobile-content send-package-page">
      <header className="send-package-header">
        <Link to="/dashboard/customer" aria-label="Back to home"><FiArrowLeft /></Link>
        <div><span>INDEPENDENT DELIVERY</span><h1>Send a package</h1></div>
        <span className="send-package-icon"><FiPackage /></span>
      </header>
      <p className="send-package-intro">Create a secure request for a permitted package, then share the recipient invitation link.</p>
      <ol className="package-steps" aria-label="Package request steps">
        {steps.map((label, index) => <li className={index === step ? 'current' : index < step ? 'complete' : ''} key={label}><span>{index < step ? <FiCheck /> : index + 1}</span>{label}</li>)}
      </ol>

      {step === 0 && <div className="package-form-panel package-locations-panel">
        <h2>Verified locations</h2>
        <p>Where should the rider collect and deliver your package? Choose a Cameroon address from the suggestions.</p>
        {['pickup', 'destination'].map((key) => (
          <section className="package-place-section" key={key}>
            <h3><FiMapPin /> {key === 'pickup' ? 'Pickup location' : 'Destination'}</h3>
            <GooglePlacePicker onSelect={(place) => updateLocation(key, { address: place.address, placeId: place.placeId, coordinates: place.coordinates })} />
            <p className={locations[key].placeId ? 'package-place-selected' : 'package-place-unselected'} role="status">{locations[key].address || 'Select a location from the address search.'}</p>
            <details className="package-location-details">
              <summary>Add landmark or instructions <span>Optional</span></summary>
              <label>{key === 'pickup' ? 'Pickup' : 'Destination'} landmark<input value={locations[key].landmark} maxLength="120" onChange={(event) => updateLocation(key, { landmark: event.target.value })} placeholder="Nearby landmark" /></label>
              <label>{key === 'pickup' ? 'Pickup' : 'Delivery'} instructions<textarea value={locations[key].instructions} maxLength="500" rows="2" onChange={(event) => updateLocation(key, { instructions: event.target.value })} placeholder="Directions for the rider" /></label>
            </details>
          </section>
        ))}
        {(locations.pickup.coordinates || locations.destination.coordinates) && <div className="package-location-map">
          <GoogleMapCanvas
            ariaLabel="Map preview of package pickup and destination"
            markers={[
              locations.pickup.coordinates && { orderId: 'package-pickup', kind: 'pickup', label: 'P', title: `Pickup: ${locations.pickup.address}`, position: locations.pickup.coordinates },
              locations.destination.coordinates && { orderId: 'package-destination', kind: 'destination', label: 'D', title: `Destination: ${locations.destination.address}`, position: locations.destination.coordinates },
            ].filter(Boolean)}
            route={locations.pickup.coordinates && locations.destination.coordinates ? { origin: locations.pickup.coordinates, destination: locations.destination.coordinates, travelMode: 'driving' } : null}
            emptyMessage="Choose the other address to preview the full route."
          />
        </div>}
        <p className="package-location-trust-note">Addresses are checked securely before the delivery fee is calculated.</p>
      </div>}

      {step === 1 && <div className="package-form-panel">
        <h2>Who is receiving it?</h2>
        <p>Enter the email and phone number linked to their CareNest account.</p>
        <label>Recipient’s CareNest email<input value={recipient.email} onChange={(event) => setRecipient((current) => ({ ...current, email: event.target.value }))} type="email" autoComplete="email" placeholder="name@example.com" required /></label>
        <label>Recipient's CareNest phone<input value={recipient.phone} onChange={(event) => setRecipient((current) => ({ ...current, phone: event.target.value }))} type="tel" autoComplete="tel" placeholder="+237 6XX XXX XXX" required /></label>
        <label>Recipient name, if known<input value={recipient.name} onChange={(event) => setRecipient((current) => ({ ...current, name: event.target.value }))} autoComplete="name" maxLength="80" placeholder="Optional" /></label>
        <p className="package-recipient-match-note">CareNest sends an in-app invitation when the email and phone match an account with notifications enabled. The recipient signs in and accepts there; no SMS is sent.</p>
      </div>}

      {step === 2 && <div className="package-form-panel">
        <h2>What are you sending?</h2><p>Items must meet CareNest's delivery policy.</p>
        <label>Package category<select value={packageInfo.category} onChange={(event) => setPackageInfo((current) => ({ ...current, category: event.target.value }))} required><option value="">Choose a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Description<textarea value={packageInfo.description} onChange={(event) => setPackageInfo((current) => ({ ...current, description: event.target.value }))} rows="3" maxLength="500" placeholder="Briefly describe the package" required /></label>
        <label>Item photos <span className="package-field-hint">Optional · up to 3 JPG, PNG, or WebP images, 5 MB each</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
          const selected = Array.from(event.target.files || [])
          const valid = selected.length <= 3 && selected.every((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size < 5 * 1024 * 1024)
          if (!valid) { setError('Choose up to 3 JPG, PNG, or WebP photos under 5 MB each.'); event.target.value = ''; return }
          setError('')
          setPackagePhotos(selected)
        }} /></label>
        {packagePhotos.length > 0 && <p className="package-photo-selection">Selected: {packagePhotos.map((photo) => photo.name).join(', ')}</p>}
        <div className="package-field-row"><label>Approx. weight (kg)<input type="number" min="0" max="100" step="0.1" value={packageInfo.weight} onChange={(event) => setPackageInfo((current) => ({ ...current, weight: event.target.value }))} placeholder="Optional" /></label><label>Number of packages<input type="number" min="1" max="10" value={packageInfo.quantity} onChange={(event) => setPackageInfo((current) => ({ ...current, quantity: event.target.value }))} /></label></div>
        <div className="package-field-row"><label>Length (cm)<input type="number" min="1" max="300" step="1" value={packageInfo.length} onChange={(event) => setPackageInfo((current) => ({ ...current, length: event.target.value }))} placeholder="Optional" /></label><label>Width (cm)<input type="number" min="1" max="300" step="1" value={packageInfo.width} onChange={(event) => setPackageInfo((current) => ({ ...current, width: event.target.value }))} placeholder="Optional" /></label><label>Height (cm)<input type="number" min="1" max="300" step="1" value={packageInfo.height} onChange={(event) => setPackageInfo((current) => ({ ...current, height: event.target.value }))} placeholder="Optional" /></label><label>Declared value (XAF)<input type="number" min="0" max="100000000" step="1" value={packageInfo.declaredValue} onChange={(event) => setPackageInfo((current) => ({ ...current, declaredValue: event.target.value }))} placeholder="Optional" /></label></div>
        <label>Who will pay the delivery fee?<select value={packageInfo.payer} onChange={(event) => setPackageInfo((current) => ({ ...current, payer: event.target.value }))} required><option value="">Choose who pays</option><option value="sender">Sender</option><option value="recipient">Recipient</option></select></label>
        <label className="package-policy-check"><input type="checkbox" checked={packageInfo.permitted} onChange={(event) => setPackageInfo((current) => ({ ...current, permitted: event.target.checked }))} /><span>I confirm this package contains no prohibited or dangerous goods.</span></label>
      </div>}

      {step === 3 && <div className="package-form-panel package-review-panel">
        <h2>Review your request</h2>
        <section><h3>Sender</h3><p>{senderName}<br />{verifiedPhone || 'Phone verification required'}</p><p>{locations.pickup.address}{locations.pickup.landmark ? ` · ${locations.pickup.landmark}` : ''}</p></section>
        <section><h3>Recipient</h3><p>{recipient.name || 'CareNest account'}<br />{recipient.phone}</p><p>{locations.destination.address}{locations.destination.landmark ? ` · ${locations.destination.landmark}` : ''}</p></section>
        <section><h3>Package</h3><p>{packageInfo.category} · {packageInfo.quantity} package(s){packageInfo.weight ? ` · ${packageInfo.weight} kg approx.` : ''}</p><p>{packageInfo.description}</p>{(packageInfo.length || packageInfo.width || packageInfo.height) && <p>Dimensions: {[packageInfo.length, packageInfo.width, packageInfo.height].map((value) => value || '–').join(' × ')} cm</p>}{packageInfo.declaredValue && <p>Declared value: {Number(packageInfo.declaredValue).toLocaleString()} XAF</p>}</section>
        <section><h3>Delivery fee</h3>
          {quote
            ? <p>{Number(quote.deliveryFee).toLocaleString()} {quote.currency} · about {quote.distanceKm} km · estimated {quote.estimatedDurationMinutes} minutes. The final server quote is fixed when you create the request.</p>
            : <p>Request a server-verified quote. No payment is taken until the recipient accepts and the designated payer confirms.</p>}
          <p>Payment arrangement: {packageInfo.payer === 'sender' ? 'Sender pays' : 'Recipient pays'}</p>
          <button type="button" className="table-action" onClick={getQuote} disabled={quoteBusy}>{quoteBusy ? 'Verifying locations...' : 'Get server quote'}</button>
        </section>
        {createdDelivery && invitationUrls[createdDelivery.firestoreId]
          ? <div className="package-backend-notice"><strong>Request created: {createdDelivery.id}</strong><p>Share the one-time invitation link with the intended recipient. It expires after 72 hours; no payment was taken.</p><input aria-label="Recipient invitation link" readOnly value={invitationUrls[createdDelivery.firestoreId]} /><button type="button" className="table-action" onClick={() => shareInvitation(createdDelivery)}>Share invitation</button></div>
          : <div className="package-backend-notice"><strong>Secure request submission</strong><p>The server verifies the address, re-calculates the fee, stores the invitation as a hash, and creates the request. The invitation link is shown only once.</p><button type="button" className="package-continue-button" disabled={submitBusy || !quote || !verifiedPhone} onClick={createRequest}>{submitBusy ? 'Creating request...' : 'Create request and invite recipient'} <FiCheck /></button></div>}
      </div>}

      {error && <p className="package-form-message" role="alert">{error}</p>}
      {message && <p className="package-form-message" role="status">{message}</p>}
      <div className="package-flow-actions">
        {step > 0 && <button type="button" className="package-back-button" onClick={() => setStep((current) => current - 1)}><FiArrowLeft /> Back</button>}
        {step < 3 && <button type="button" className="package-continue-button" onClick={continueFlow}>Continue <FiArrowRight /></button>}
        {step === 3 && <Link className="package-back-button" to="/dashboard/customer"><FiArrowLeft /> Return home</Link>}
      </div>

      <section className="package-form-panel package-requests-panel">
        <details className="package-delivery-history" open={Boolean(requestedDeliveryId)}>
          <summary>{requestedDeliveryId ? 'Delivery status' : 'Your package deliveries'} <span>{displayedDeliveries.length ? `${displayedDeliveries.length} request${displayedDeliveries.length === 1 ? '' : 's'}` : 'View history'}</span></summary>
        {deliveryLoadError && <p className="package-history-error" role="status">Your delivery list could not refresh. {deliveryLoadError}</p>}
        {trackedDelivery && <div className="package-customer-tracking-map">
          <h3>Delivery map · {trackedDelivery.id}</h3>
          <GoogleMapCanvas
            ariaLabel={`Map for package delivery ${trackedDelivery.id}`}
            markers={[
              trackedDelivery.riderLocation && { orderId: trackedDelivery.firestoreId, kind: 'rider', label: 'R', title: `Rider location for ${trackedDelivery.id}`, position: trackedDelivery.riderLocation },
              trackedDelivery.pickupCoordinates && { orderId: trackedDelivery.firestoreId, kind: 'pickup', label: 'P', title: `Pickup for ${trackedDelivery.id}`, position: trackedDelivery.pickupCoordinates },
              trackedDelivery.addressCoordinates && { orderId: trackedDelivery.firestoreId, kind: 'destination', label: 'D', title: `Destination for ${trackedDelivery.id}`, position: trackedDelivery.addressCoordinates },
            ].filter(Boolean)}
            route={trackedDelivery.addressCoordinates && (trackedDelivery.riderLocation || trackedDelivery.pickupCoordinates) ? { origin: trackedDelivery.riderLocation || trackedDelivery.pickupCoordinates, destination: trackedDelivery.addressCoordinates, travelMode: 'driving' } : null}
            emptyMessage="Verified delivery locations will appear here."
          />
        </div>}
        {!displayedDeliveries.length && <p className="dashboard-empty">{requestedDeliveryId ? 'That delivery was not found in your account.' : 'Your submitted package requests will appear here.'}</p>}
        {displayedDeliveries.map((delivery) => {
          const isPayer = delivery.canPay
          const paymentStatus = String(delivery.payment?.status || '').toLowerCase()
          const shouldStartPayment = delivery.status === 'awaiting_payment' && isPayer && !['paid', 'submitted', 'starting', 'unknown'].includes(paymentStatus)
          const shouldVerifyPayment = delivery.status === 'awaiting_payment' && isPayer && ['submitted', 'starting', 'unknown'].includes(paymentStatus)
          return <article className="package-delivery-card" key={delivery.firestoreId}>
            <header><strong>{delivery.id}</strong><span className="status-chip">{statusLabel(delivery.status)}</span></header>
            {delivery.currentUserRole === 'recipient' && <p>From {delivery.senderName || 'CareNest sender'}</p>}
            <p>{delivery.pickupAddress} → {delivery.address}</p>
            {delivery.packageCategory && <p><strong>{delivery.packageCategory}</strong>{delivery.packageDescription ? ` · ${delivery.packageDescription}` : ''}</p>}
            {delivery.packagePhotoUrls?.length > 0 && <div className="package-recipient-photos" aria-label="Package photos">{delivery.packagePhotoUrls.map((url, index) => <img src={url} alt={`Package photo ${index + 1}`} key={url} loading="lazy" />)}</div>}
            <p>{delivery.pricing?.deliveryFee ? `${Number(delivery.pricing.deliveryFee).toLocaleString()} XAF` : 'Fee pending'} · {delivery.riderName || (delivery.hasRider ? 'Rider assigned' : 'No rider assigned')}</p>
            {invitationUrls[delivery.firestoreId] && <input aria-label="Recipient invitation link" readOnly value={invitationUrls[delivery.firestoreId]} />}
            {delivery.status === 'awaiting_recipient' && delivery.currentUserRole === 'sender' && <button type="button" className="table-action" disabled={inviteBusyId === delivery.firestoreId} onClick={() => shareInvitation(delivery)}>{inviteBusyId === delivery.firestoreId ? 'Creating link...' : 'Share recipient invitation'}</button>}
            {delivery.status === 'awaiting_payment' && !isPayer && <p>The designated payer must complete payment before dispatch.</p>}
            {shouldStartPayment && <div className="package-payment-action"><label>Mobile Money number<input type="tel" value={paymentPhones[delivery.firestoreId] || verifiedPhone || profile?.phone || ''} onChange={(event) => setPaymentPhones((current) => ({ ...current, [delivery.firestoreId]: event.target.value }))} /></label><button type="button" className="table-action" disabled={paymentBusyId === delivery.firestoreId} onClick={() => startPayment(delivery)}>{paymentBusyId === delivery.firestoreId ? 'Sending...' : 'Pay securely with Mobile Money'}</button></div>}
            {shouldVerifyPayment && <button type="button" className="table-action" disabled={paymentBusyId === delivery.firestoreId} onClick={() => startPayment(delivery, true)}>{paymentBusyId === delivery.firestoreId ? 'Checking...' : `Check payment (${statusLabel(paymentStatus)})`}</button>}
            {delivery.currentUserRole === 'sender' && ['awaiting_recipient', 'awaiting_payment'].includes(delivery.status) && !['starting', 'unknown', 'submitted', 'paid'].includes(paymentStatus) && <button type="button" className="table-action secondary" disabled={paymentBusyId === delivery.firestoreId} onClick={() => cancelDelivery(delivery)}>Cancel request</button>}
            <p>Recipient acceptance: {statusLabel(delivery.recipientAcceptance?.status)} · Payment: {statusLabel(paymentStatus || 'not started')}</p>
          </article>
        })}
        </details>
      </section>
    </section>
  )
}

export default SendPackagePage
