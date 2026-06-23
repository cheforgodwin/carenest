import { Link } from 'react-router-dom'
import { FiBell, FiMapPin, FiPhone } from 'react-icons/fi'
import MobileFrame, { AppIcon } from '../../components/MobileApp/MobileFrame'
import { activity, quickActions } from '../../data/customerAppData'
import './CustomerApp.css'

function CustomerHomePage() {
  return (
    <MobileFrame showMenu activeTab="home" title="">
      <div className="customer-top">
        <div className="customer-logo">
          <strong>CareNest</strong>
          <small>Your home, cared for.</small>
        </div>
        <button className="icon-button" type="button" aria-label="Notifications">
          <FiBell />
        </button>
      </div>

      <div className="greeting-block">
        <p>Good morning,</p>
        <h2>John Doe</h2>
        <span className="location-line"><FiMapPin /> Bastos, Yaounde</span>
      </div>

      <section className="home-hero-card">
        <div>
          <h3>We take care of what matters at home.</h3>
          <Link to="/customer/services">Learn More</Link>
        </div>
        <div className="service-visual"><AppIcon name="washer" /></div>
      </section>

      <div className="section-row">
        <h3>Quick Actions</h3>
        <Link to="/customer/services">See all</Link>
      </div>
      <div className="quick-actions">
        {quickActions.map((action) => (
          <Link key={action.label} to={action.to}>
            <AppIcon name={action.icon} />
            {action.label}
          </Link>
        ))}
      </div>

      <div className="section-row">
        <h3>Your Current Order</h3>
        <Link to="/customer/orders/CN-023">View all</Link>
      </div>
      <Link className="order-mini-card" to="/customer/orders/CN-023">
        <div className="order-mini-head">
          <span className="mini-icon"><AppIcon name="washer" /></span>
          <div>
            <strong>Laundry Order - CN-023</strong>
            <span>Pickup: Today, 10:00 AM</span>
          </div>
          <span className="status-pill">In Progress</span>
        </div>
        <div className="mini-progress">
          <span className="done"><small>Requested</small></span>
          <span className="done"><small>Picked Up</small></span>
          <span className="done"><small>Washing</small></span>
          <span><small>Delivered</small></span>
        </div>
      </Link>

      <div className="section-row">
        <h3>Recent Activity</h3>
        <Link to="/customer/orders/CN-023">See all</Link>
      </div>
      <div className="activity-list">
        {activity.map(([id, service, status, date, amount]) => (
          <div className="activity-row" key={id}>
            <span className="mini-icon"><AppIcon name={service === 'Laundry' ? 'washer' : 'cleaning'} /></span>
            <div>
              <strong>{id}</strong>
              <span>{service}</span>
            </div>
            <div className="activity-price">
              <span className="status-pill">{status}</span>
              <p>{date}<br />{amount}</p>
            </div>
          </div>
        ))}
      </div>

      <a className="floating-call" href="tel:+237612345678" aria-label="Call CareNest">
        <FiPhone />
      </a>
    </MobileFrame>
  )
}

export default CustomerHomePage
