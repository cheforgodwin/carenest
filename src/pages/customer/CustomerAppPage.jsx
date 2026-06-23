import { Link, useLocation } from 'react-router-dom'
import { FiBriefcase, FiCheck, FiGift, FiHome, FiPhone, FiUser } from 'react-icons/fi'
import './CustomerAppPage.css'

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
          <section className="mobile-content">
            <h1>CareNest</h1>
            <p>Good morning, John Doe</p>
            <div className="mobile-hero">
              <h2>We take care of what matters at home.</h2>
              <Link to="/customer/services">Book service</Link>
            </div>
            <div className="quick-grid">
              <Link to="/customer/laundry-request"><FiBriefcase />Laundry</Link>
              <Link to="/customer/services"><FiGift />Cleaning</Link>
              <Link to="/customer/services"><FiHome />Essentials</Link>
              <a href="tel:+237612345678"><FiPhone />Call</a>
            </div>
            <Link className="order-card" to="/customer/orders/CN-023">
              <strong>Laundry Order - CN-023</strong>
              <span>In Progress</span>
              <p>Pickup today, 10:00 AM</p>
            </Link>
          </section>
        )}

        {isServices && (
          <section className="mobile-content">
            <h1>Services</h1>
            {['Laundry Service', 'Home Cleaning', 'Essentials Delivery'].map((service) => (
              <article className="service-card" key={service}>
                <FiBriefcase />
                <div><h2>{service}</h2><p>Book trusted home service providers.</p><Link to="/customer/laundry-request">Book Now</Link></div>
              </article>
            ))}
          </section>
        )}

        {isRequest && (
          <section className="mobile-content">
            <h1>Laundry Request</h1>
            <div className="request-box"><FiCheck /><strong>Normal</strong><span>2 - 3 Days</span></div>
            <label>Clothes Type<div>Select type</div></label>
            <label>Pickup Address<div>Bastos, Yaounde</div></label>
            <label>Pickup Time<div>10:00 AM</div></label>
            <button type="button">Continue</button>
          </section>
        )}

        {isOrder && (
          <section className="mobile-content">
            <h1>Order Tracking</h1>
            <div className="mobile-hero"><h2>Laundry Order CN-023</h2><span>In Progress</span></div>
            {['Requested', 'Picked Up', 'Washing', 'Ironing', 'Delivered'].map((step, index) => (
              <div className="track-row" key={step}><span className={index < 3 ? 'done' : ''}></span><strong>{step}</strong></div>
            ))}
            <a className="call-card" href="tel:+237612345678"><FiPhone /> Call CareNest</a>
          </section>
        )}

        <nav className="mobile-tabs">
          <Link to="/customer"><FiHome />Home</Link>
          <Link to="/customer/orders/CN-023"><FiBriefcase />Orders</Link>
          <Link to="/customer/services"><FiGift />Services</Link>
          <Link to="/login"><FiUser />Profile</Link>
        </nav>
      </section>
    </main>
  )
}

export default CustomerAppPage
