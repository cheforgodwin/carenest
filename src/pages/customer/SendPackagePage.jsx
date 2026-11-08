import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiCheck, FiCrosshair, FiMapPin, FiMinus, FiPackage, FiPlus } from 'react-icons/fi'
import './SendPackagePage.css'

const steps = ['Locations', 'Recipient', 'Package', 'Review']
const emptyLocation = { address: '', landmark: '', instructions: '', x: 30, y: 58 }

function SendPackagePage({ profile, user }) {
  const mapRef = useRef(null)
  const [step, setStep] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [activePin, setActivePin] = useState('pickup')
  const [locations, setLocations] = useState({ pickup: { ...emptyLocation }, destination: { ...emptyLocation, x: 70, y: 36 } })
  const [senderPhone, setSenderPhone] = useState(profile?.phone || '')
  const [recipient, setRecipient] = useState({ phone: '', name: '' })
  const [packageInfo, setPackageInfo] = useState({ category: '', description: '', weight: '', length: '', width: '', height: '', declaredValue: '', quantity: '1', permitted: false, payer: '' })
  const [locationMessage, setLocationMessage] = useState('')
  const [formError, setFormError] = useState('')

  function movePin(event) {
    const bounds = mapRef.current?.getBoundingClientRect()
    if (!bounds) return
    setLocations((current) => ({
      ...current,
      [activePin]: {
        ...current[activePin],
        x: Math.max(5, Math.min(95, ((event.clientX - bounds.left) / bounds.width) * 100)),
        y: Math.max(8, Math.min(92, ((event.clientY - bounds.top) / bounds.height) * 100)),
      },
    }))
    setLocationMessage('Pin moved. Enter the exact address or landmark below.')
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location access is unavailable in this browser. Enter the address manually.')
      return
    }
    setLocationMessage('Getting your current location...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocations((current) => ({
          ...current,
          pickup: { ...current.pickup, x: 49, y: 55, coordinates: { latitude: coords.latitude, longitude: coords.longitude } },
        }))
        setActivePin('pickup')
        setLocationMessage('Current GPS point selected. Add a street address or landmark to help the rider.')
      },
      () => setLocationMessage('Location permission was not granted. Enter the pickup address manually.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function continueFlow() {
    if (step === 0 && (!locations.pickup.address.trim() || !locations.destination.address.trim() || !senderPhone.trim())) {
      setLocationMessage('Add a pickup address, destination address, and contact phone to continue.')
      return
    }
    if (step === 1 && !/^\+?237\s?6\d{2}[\s-]?\d{3}[\s-]?\d{3}$/.test(recipient.phone.trim())) {
      setFormError('Enter a valid Cameroon mobile number for the recipient.')
      return
    }
    if (step === 2 && (!packageInfo.category || !packageInfo.description.trim() || !packageInfo.permitted || !packageInfo.payer)) {
      setFormError('Complete the package details, select who pays, and confirm the prohibited-items policy.')
      return
    }
    setStep((current) => Math.min(steps.length - 1, current + 1))
    setLocationMessage('')
    setFormError('')
  }

  const senderName = profile?.name || user?.displayName || 'Your CareNest account'

  return (
    <section className="mobile-content send-package-page">
      <header className="send-package-header">
        <Link to="/dashboard/customer" aria-label="Back to home"><FiArrowLeft /></Link>
        <div><span>INDEPENDENT DELIVERY</span><h1>Send a package</h1></div>
        <span className="send-package-icon"><FiPackage /></span>
      </header>
      <p className="send-package-intro">Send anything permitted to someone, anywhere we serve.</p>
      <ol className="package-steps" aria-label="Package request steps">
        {steps.map((label, index) => <li className={index === step ? 'current' : index < step ? 'complete' : ''} key={label}><span>{index < step ? <FiCheck /> : index + 1}</span>{label}</li>)}
      </ol>

      {step === 0 && <>
        <div className="package-map-toolbar">
          <div className="package-pin-switch" aria-label="Choose a pin to move">
            <button type="button" className={activePin === 'pickup' ? 'selected' : ''} onClick={() => setActivePin('pickup')}><FiMapPin /> Pickup</button>
            <button type="button" className={activePin === 'destination' ? 'selected destination' : ''} onClick={() => setActivePin('destination')}><FiMapPin /> Destination</button>
          </div>
          <button type="button" className="package-icon-action" onClick={useCurrentLocation} aria-label="Use current GPS location" title="Use current GPS location"><FiCrosshair /></button>
        </div>
        <div className="package-map" ref={mapRef} onClick={movePin} onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
          event.preventDefault()
          const xChange = event.key === 'ArrowLeft' ? -2 : event.key === 'ArrowRight' ? 2 : 0
          const yChange = event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : 0
          setLocations((current) => ({ ...current, [activePin]: { ...current[activePin], x: Math.max(5, Math.min(95, current[activePin].x + xChange)), y: Math.max(8, Math.min(92, current[activePin].y + yChange)) } }))
        }} tabIndex="0" role="application" aria-label="Map preview. Use arrow keys or click to move the selected location pin.">
          <div className="package-map-neighborhood" style={{ transform: `scale(${zoom})` }}>
            <span className="map-district district-one">Mvan</span><span className="map-district district-two">Bastos</span><span className="map-district district-three">Yaounde</span>
            <i className="map-road road-one" /><i className="map-road road-two" /><i className="map-road road-three" /><i className="map-road road-four" /><i className="map-road road-five" />
            <i className="map-park park-one" /><i className="map-park park-two" />
            <svg className="package-route-preview" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={locations.pickup.x} y1={locations.pickup.y} x2={locations.destination.x} y2={locations.destination.y} /></svg>
          </div>
          <span className="package-map-label map-label-top">Yaounde, Centre</span>
          <button type="button" className="package-marker pickup-marker" style={{ left: `${locations.pickup.x}%`, top: `${locations.pickup.y}%` }} onClick={(event) => { event.stopPropagation(); setActivePin('pickup') }} aria-label="Select pickup pin"><FiMapPin /></button>
          <button type="button" className="package-marker destination-marker" style={{ left: `${locations.destination.x}%`, top: `${locations.destination.y}%` }} onClick={(event) => { event.stopPropagation(); setActivePin('destination') }} aria-label="Select destination pin"><FiMapPin /></button>
          <div className="package-map-controls"><button type="button" aria-label="Zoom in" onClick={(event) => { event.stopPropagation(); setZoom((value) => Math.min(1.35, value + 0.1)) }}><FiPlus /></button><button type="button" aria-label="Zoom out" onClick={(event) => { event.stopPropagation(); setZoom((value) => Math.max(0.85, value - 0.1)) }}><FiMinus /></button></div>
          <span className="map-placeholder-note">Map preview · precise map service not connected</span>
        </div>
        <div className="package-location-fields">
          <label>Pickup address<input value={locations.pickup.address} onChange={(event) => setLocations((current) => ({ ...current, pickup: { ...current.pickup, address: event.target.value } }))} placeholder="Neighborhood, street or building" /></label>
          <label>Pickup landmark<input value={locations.pickup.landmark} onChange={(event) => setLocations((current) => ({ ...current, pickup: { ...current.pickup, landmark: event.target.value } }))} placeholder="Near a recognizable place" /></label>
          <label>Destination address<input value={locations.destination.address} onChange={(event) => setLocations((current) => ({ ...current, destination: { ...current.destination, address: event.target.value } }))} placeholder="Neighborhood, street or building" /></label>
          <label>Destination landmark<input value={locations.destination.landmark} onChange={(event) => setLocations((current) => ({ ...current, destination: { ...current.destination, landmark: event.target.value } }))} placeholder="Near a recognizable place" /></label>
          <label>Pickup contact phone<input value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="+237 6XX XXX XXX" /></label>
          <label>Pickup instructions<textarea value={locations.pickup.instructions} onChange={(event) => setLocations((current) => ({ ...current, pickup: { ...current.pickup, instructions: event.target.value } }))} placeholder="Gate, floor, or directions" rows="2" /></label>
        </div>
        {locationMessage && <p className="package-form-message" role="status">{locationMessage}</p>}
      </>}

      {step === 1 && <div className="package-form-panel">
        <h2>Who is receiving it?</h2><p>The recipient must have a verified CareNest account and accept before delivery can proceed.</p>
        <label>Recipient's CareNest phone<input value={recipient.phone} onChange={(event) => setRecipient((current) => ({ ...current, phone: event.target.value }))} type="tel" autoComplete="tel" placeholder="+237 6XX XXX XXX" required /></label>
        <label>Recipient name, if known<input value={recipient.name} onChange={(event) => setRecipient((current) => ({ ...current, name: event.target.value }))} autoComplete="name" placeholder="Name to help identify the recipient" /></label>
        <label>Delivery instructions<textarea value={locations.destination.instructions} onChange={(event) => setLocations((current) => ({ ...current, destination: { ...current.destination, instructions: event.target.value } }))} rows="3" placeholder="How should the rider find the recipient?" /></label>
        <div className="package-security-note"><FiMapPin /><span>We cannot verify a recipient account or reveal account details until secure phone lookup is available. No invitation will be sent in this preview.</span></div>
      </div>}

      {step === 2 && <div className="package-form-panel">
        <h2>What are you sending?</h2><p>CareNest may reject packages that do not meet its delivery policy.</p>
        <label>Package category<select value={packageInfo.category} onChange={(event) => setPackageInfo((current) => ({ ...current, category: event.target.value }))} required><option value="">Choose a category</option>{['Documents', 'Clothing', 'Electronics', 'Permitted food', 'Household items', 'Personal belongings', 'Other permitted items'].map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Description<textarea value={packageInfo.description} onChange={(event) => setPackageInfo((current) => ({ ...current, description: event.target.value }))} rows="3" maxLength="500" placeholder="Briefly describe the package" required /></label>
        <div className="package-field-row"><label>Approx. weight (kg)<input type="number" min="0.1" step="0.1" value={packageInfo.weight} onChange={(event) => setPackageInfo((current) => ({ ...current, weight: event.target.value }))} placeholder="Optional" /></label><label>Number of packages<input type="number" min="1" max="10" value={packageInfo.quantity} onChange={(event) => setPackageInfo((current) => ({ ...current, quantity: event.target.value }))} /></label></div>
        <div className="package-field-row"><label>Length (cm)<input type="number" min="1" value={packageInfo.length} onChange={(event) => setPackageInfo((current) => ({ ...current, length: event.target.value }))} placeholder="Optional" /></label><label>Width (cm)<input type="number" min="1" value={packageInfo.width} onChange={(event) => setPackageInfo((current) => ({ ...current, width: event.target.value }))} placeholder="Optional" /></label><label>Height (cm)<input type="number" min="1" value={packageInfo.height} onChange={(event) => setPackageInfo((current) => ({ ...current, height: event.target.value }))} placeholder="Optional" /></label><label>Declared value (XAF)<input type="number" min="0" value={packageInfo.declaredValue} onChange={(event) => setPackageInfo((current) => ({ ...current, declaredValue: event.target.value }))} placeholder="Optional" /></label></div>
        <label>Who will pay the delivery fee?<select value={packageInfo.payer} onChange={(event) => setPackageInfo((current) => ({ ...current, payer: event.target.value }))} required><option value="">Choose who pays</option><option value="sender">Sender</option><option value="recipient">Recipient</option></select></label>
        <label className="package-policy-check"><input type="checkbox" checked={packageInfo.permitted} onChange={(event) => setPackageInfo((current) => ({ ...current, permitted: event.target.checked }))} /><span>I confirm this package contains no prohibited or dangerous goods.</span></label>
      </div>}

      {step === 3 && <div className="package-form-panel package-review-panel">
        <h2>Review your request</h2>
        <section><h3>Sender</h3><p>{senderName}<br />{senderPhone || 'Phone not provided'}</p><p>{locations.pickup.address}{locations.pickup.landmark ? ` · ${locations.pickup.landmark}` : ''}</p></section>
        <section><h3>Recipient</h3><p>{recipient.name || 'Recipient name not confirmed'}<br />{recipient.phone}</p><p>{locations.destination.address}{locations.destination.landmark ? ` · ${locations.destination.landmark}` : ''}</p><p>{locations.destination.instructions || 'No delivery instructions'}</p></section>
        <section><h3>Package</h3><p>{packageInfo.category} · {packageInfo.quantity} package(s){packageInfo.weight ? ` · ${packageInfo.weight} kg approx.` : ''}</p><p>{packageInfo.description}</p>{(packageInfo.length || packageInfo.width || packageInfo.height) && <p>Dimensions: {[packageInfo.length, packageInfo.width, packageInfo.height].map((value) => value || '–').join(' × ')} cm</p>}{packageInfo.declaredValue && <p>Declared value: {Number(packageInfo.declaredValue).toLocaleString()} XAF</p>}</section>
        <section><h3>Delivery fee</h3><p>Price and arrival estimate will be provided by CareNest after location and package validation. No amount has been quoted.</p><p>Payment arrangement: {packageInfo.payer === 'sender' ? 'Sender pays' : 'Recipient pays'}</p></section>
        <div className="package-backend-notice"><strong>Request submission is not available yet</strong><p>Secure recipient verification, invitation, acceptance, server pricing, payment confirmation, and delivery tracking need a trusted CareNest delivery service. No request or charge has been created.</p></div>
      </div>}

      {formError && <p className="package-form-message" role="alert">{formError}</p>}
      <div className="package-flow-actions">
        {step > 0 && <button type="button" className="package-back-button" onClick={() => setStep((current) => current - 1)}><FiArrowLeft /> Back</button>}
        {step < 3 && <button type="button" className="package-continue-button" onClick={continueFlow}>Continue <FiArrowRight /></button>}
        {step === 3 && <Link className="package-continue-button package-done-button" to="/dashboard/customer"><FiCheck /> Return home</Link>}
      </div>
    </section>
  )
}

export default SendPackagePage