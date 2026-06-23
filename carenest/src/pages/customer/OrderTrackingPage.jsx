import { FiCheck, FiPhone } from 'react-icons/fi'
import MobileFrame, { AppIcon } from '../../components/MobileApp/MobileFrame'
import { trackingSteps } from '../../data/customerAppData'
import './CustomerApp.css'

function OrderTrackingPage() {
  return (
    <MobileFrame title="Order Tracking" backTo="/customer" activeTab="orders">
      <section className="tracking-summary">
        <span className="mini-icon"><AppIcon name="washer" /></span>
        <div>
          <h2>Laundry Order</h2>
          <strong>CN-023</strong>
          <p>Placed on 12 May 2024</p>
          <span className="status-pill">In Progress</span>
        </div>
        <div className="folded-stack" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </section>

      <div className="tracking-list">
        {trackingSteps.map(([title, detail, state]) => (
          <div className={`tracking-item ${state}`} key={title}>
            <span className="track-dot">{state !== 'pending' && <FiCheck />}</span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="support-card">
        <div>
          <h3>Need help?</h3>
          <p>Call us for any support</p>
        </div>
        <a href="tel:+237612345678"><FiPhone /> Call CareNest</a>
      </section>
    </MobileFrame>
  )
}

export default OrderTrackingPage
