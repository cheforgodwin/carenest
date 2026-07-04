import { Link, useLocation } from 'react-router-dom'
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
  FiUser,
  FiZap,
} from 'react-icons/fi'
import Logo from '../../components/Logo'
import './CustomerAppPage.css'

const quickActions = [
  ['Laundry', FiShoppingBag, '/customer/laundry-request'],
  ['Cleaning', FiTool, '/customer/services'],
  ['Essentials', FiPackage, '/customer/services'],
  ['Call CareNest', FiPhone, 'tel:+237612345678'],
]

const services = [
  ['Laundry Service', 'We wash, iron and deliver to your door.', 'laundry'],
  ['Home Cleaning', 'Professional cleaning for your home.', 'cleaning'],
  ['Essentials Delivery', 'Order household essentials and we deliver fast.', 'essentials'],
]

const timeline = [
  ['Requested', '12 May 2024, 09:15 AM', 'done'],
  ['Picked Up', '12 May 2024, 10:05 AM', 'done'],
  ['Washing', 'In Progress', 'active'],
  ['Ironing', 'Pending', 'pending'],
  ['Out for Delivery', 'Pending', 'pending'],
  ['Delivered', 'Pending', 'pending'],
]

function CustomerAppPage() {
  const { pathname } = useLocation()
  const isServices = pathname.includes('/services')
  const isRequest = pathname.includes('/laundry-request')
  const isOrder = pathname.includes('/orders')

  return (
    <main className="mobile-app-page">
      <section className="mobile-phone">
        <header className="mobile-status"><strong>9:41</strong><span>LTE</span></header>

        {!isServices && !isRequest && !isOrder && (
          <section className="mobile-content mobile-content-home">
            <div className="app-header">
              <button className="icon-button" type="button" aria-label="Open menu"><FiMenu /></button>
              <Logo to="/customer" compact />
              <button className="icon-button notification-button" type="button" aria-label="Notifications"><FiBell /><span>3</span></button>
            </div>
            <div className="home-primary">
              <div className="customer-greeting">
                <div>
                  <p>Good morning,</p>
                  <h1>John Doe <span>waves</span></h1>
                  <small><FiMapPin /> Bastos, Yaounde</small>
                </div>
                <div className="avatar">JD</div>
              </div>
              <div className="mobile-hero">
                <div>
                  <h2>We take care of what matters at home.</h2>
                  <Link to="/customer/services">Learn More</Link>
                </div>
                <div className="hero-art hero-art-laundry"><FiShoppingBag /></div>
              </div>
            </div>
            <div className="home-secondary">
              <div className="section-title"><strong>Quick Actions</strong><Link to="/customer/services">See all</Link></div>
              <div className="quick-grid">
                {quickActions.map(([label, Icon, to]) => (
                  to.startsWith('tel:')
                    ? <a className={label.includes('Call') ? 'orange-action' : ''} href={to} key={label}><Icon />{label}</a>
                    : <Link to={to} key={label}><Icon />{label}</Link>
                ))}
              </div>
              <div className="section-title"><strong>Your Current Order</strong><Link to="/customer/orders/CN-023">View all</Link></div>
              <Link className="order-card" to="/customer/orders/CN-023">
                <div className="order-icon"><FiShoppingBag /></div>
                <div className="order-summary">
                  <strong>Laundry Order - CN-023</strong>
                  <p>Pickup: Today, 10:00 AM</p>
                  <p><b>Items:</b> 7 Shirts, 2 Trousers, 2 Towels</p>
                </div>
                <span>In Progress</span>
                <div className="mini-progress"><i></i><i></i><i></i><i></i></div>
              </Link>
              <div className="section-title"><strong>Recent Activity</strong><Link to="/customer/orders/CN-023">See all</Link></div>
              <div className="activity-list">
                <div><FiShoppingBag /><strong>CN-021</strong><span>Laundry</span><b>Completed</b><small>12 May 2024<br />3,000 FCFA</small></div>
                <div><FiTool /><strong>CN-018</strong><span>Cleaning</span><b>Completed</b><small>10 May 2024<br />6,000 FCFA</small></div>
              </div>
            </div>
            <a className="floating-call" href="tel:+237612345678" aria-label="Call CareNest"><FiPhone /></a>
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
                {services.map(([service, description, tone]) => (
                  <article className={`service-card service-card-${tone}`} key={service}>
                    <div className={`service-art service-art-${tone}`}>
                      {tone === 'laundry' && <FiShoppingBag />}
                      {tone === 'cleaning' && <FiTool />}
                      {tone === 'essentials' && <FiPackage />}
                    </div>
                    <div><h2>{service}</h2><p>{description}</p><Link to="/customer/laundry-request">Book Now <FiArrowRight /></Link></div>
                  </article>
                ))}
              </div>
              <div className="service-support-strip">
                <span><FiCheck /> Verified providers</span>
                <span><FiClock /> Reliable pickup times</span>
                <a href="tel:+237612345678"><FiPhone /> Call CareNest</a>
              </div>
            </div>
          </section>
        )}

        {isRequest && (
          <section className="mobile-content mobile-content-request">
            <div className="request-shell">
              <div className="request-main">
                <div className="top-title"><Link to="/customer/services"><FiArrowLeft /></Link><h1>Laundry Request</h1></div>
                <div className="stepper"><span className="active">1<small>Details</small></span><i></i><span>2<small>Pickup</small></span><i></i><span>3<small>Review</small></span></div>
                <strong className="form-section-label">Service Type</strong>
                <div className="request-options">
                  <div className="request-box selected"><FiShoppingBag /><strong>Normal</strong><span>2 - 3 Days</span><b><FiCheck /></b></div>
                  <div className="request-box"><FiZap /><strong>Express</strong><span>24 Hours</span></div>
                </div>
                <div className="request-field-grid">
                  <label>Clothes Type<div>Select type <FiChevronDown /></div></label>
                  <label>Pickup Address<div><FiMapPin /> Bastos, Yaounde <FiChevronDown /></div></label>
                  <label>Pickup Date<div><FiCalendar /> 15 May 2024</div></label>
                  <label>Pickup Time<div><FiClock /> 10:00 AM</div></label>
                  <label className="request-note-field">Additional Note (Optional)<div className="note-box">E.g. Gate code, special instructions...</div></label>
                </div>
                <div className="request-submit-row">
                  <span><small>Estimated total</small><strong>3,000 FCFA</strong></span>
                  <button type="button">Continue</button>
                </div>
              </div>
              <div className="request-aside">
                <div className="aside-visual"><FiShoppingBag /></div>
                <h2>Fresh laundry, handled carefully.</h2>
                <p>Choose your service speed, confirm pickup details, and CareNest will keep you updated from pickup to delivery.</p>
                <div className="aside-list">
                  <span><FiCheck /> Pickup reminder</span>
                  <span><FiCheck /> Status tracking</span>
                  <span><FiPhone /> Fast support</span>
                </div>
                <a href="tel:+237612345678"><FiPhone /> Call CareNest</a>
              </div>
            </div>
          </section>
        )}

        {isOrder && (
          <section className="mobile-content mobile-content-order">
            <div className="tracking-shell">
              <div className="tracking-main">
                <div className="top-title"><Link to="/customer"><FiArrowLeft /></Link><h1>Order Tracking</h1></div>
                <div className="tracking-hero">
                  <div className="order-machine"><FiShoppingBag /></div>
                  <div><h2>Laundry Order</h2><strong>CN-023</strong><p>Placed on 12 May 2024</p><span>In Progress</span></div>
                </div>
                {timeline.map(([step, detail, status]) => (
                  <div className={`track-row ${status}`} key={step}><span>{status !== 'pending' && <FiCheck />}</span><div><strong>{step}</strong><p>{detail}</p></div></div>
                ))}
              </div>
              <aside className="tracking-aside">
                <h2>Order summary</h2>
                <div><span>Service</span><strong>Laundry</strong></div>
                <div><span>Pickup</span><strong>Today, 10:00 AM</strong></div>
                <div><span>Items</span><strong>11 clothes</strong></div>
                <div><span>Amount</span><strong>3,000 FCFA</strong></div>
                <a className="call-card" href="tel:+237612345678"><div><strong>Need help?</strong><p>Call us for any support</p></div><span><FiPhone /> Call CareNest</span></a>
              </aside>
            </div>
          </section>
        )}

        <nav className="mobile-tabs">
          <Logo to="/customer" className="customer-nav-brand" />
          <div className="customer-nav-links">
            <Link to="/customer"><FiHome />Home</Link>
            <Link to="/customer/orders/CN-023"><FiBriefcase />Orders</Link>
            <Link to="/customer/services"><FiGift />Services</Link>
            <Link to="/login"><FiUser />Profile</Link>
          </div>
        </nav>
      </section>
    </main>
  )
}

export default CustomerAppPage
