import Icon from '../../components/Icon/Icon'
import Logo from '../../components/Logo/Logo'
import { orderSteps, services } from '../../data/homeData'
import './AppPreview.css'

function AppPreview() {
  return (
    <section className="page-section app-preview-section">
      <div className="section-shell app-preview-grid">
        <div className="phone-frame" aria-label="CareNest app home screen preview">
          <div className="phone-status">
            <span>9:41</span>
            <span>LTE</span>
          </div>
          <div className="phone-head">
            <Logo />
            <div className="avatar">JD</div>
          </div>
          <p className="greeting">Good morning, John</p>
          <section className="promo-panel">
            <div>
              <strong>What does your home need today?</strong>
              <button type="button">Book now</button>
            </div>
          </section>
          <div className="quick-grid">
            {services.map((service) => (
              <button type="button" key={service.name}>
                <Icon name={service.icon} />
                {service.name}
              </button>
            ))}
          </div>
          <section className="order-card">
            <div className="order-top">
              <strong>Laundry Order - CN-023</strong>
              <span>In progress</span>
            </div>
            <div className="progress-line">
              {orderSteps.slice(0, 4).map((step, index) => (
                <span className={index < 3 ? 'done' : ''} key={step}></span>
              ))}
            </div>
            <p>Pickup today, 10:00 AM</p>
          </section>
        </div>

        <div className="app-preview-copy">
          <p className="eyebrow">Built for mobile first</p>
          <h2>Customers always know what is happening.</h2>
          <p className="lead">
            The home screen puts common services, order tracking and support one tap away. Providers
            get clearer jobs, and operations can follow the full customer journey.
          </p>
          <div className="feature-list">
            <span><Icon name="shield" /> Verified service providers</span>
            <span><Icon name="card" /> Mobile Money-ready payments</span>
            <span><Icon name="phone" /> Support for active orders</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AppPreview
