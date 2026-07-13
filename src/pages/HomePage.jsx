import { FiArrowRight, FiCheckCircle, FiClock, FiHeadphones, FiShield } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import './HomePage.css'

const services = ['Laundry', 'Home Cleaning', 'Essentials Delivery', 'Repairs']

function HomePage() {
  return (
    <main className="home-page">
      <Navbar />
      <section className="hero">
        <div>
          <p className="eyebrow">Home services in one trusted app</p>
          <h1>Laundry, cleaning and home help without the back-and-forth.</h1>
          <p className="lead">CareNest helps households book verified providers, schedule pickup times, pay clearly and track every request.</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/signup">Create account</Link>
            <Link className="secondary-action" to="/dashboard/customer">Book a service</Link>
          </div>
        </div>
        <div className="hero-card">
          <strong>Laundry Order CN-023</strong>
          <span>In Progress</span>
          <p>Pickup today at 10:00 AM. Washing is underway.</p>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Everyday home care</p>
          <h2>Services customers can book quickly.</h2>
        </div>
        <div className="service-grid">
          {services.map((service) => (
            <article key={service}>
              <FiCheckCircle />
              <h3>{service}</h3>
              <p>Simple booking, clear pricing and trackable status updates.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section dark-section" id="how">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>Choose, schedule, track.</h2>
        </div>
        <div className="trust-grid">
          <span><FiShield /> Verified providers</span>
          <span><FiClock /> Fast service</span>
          <span><FiHeadphones /> 24/7 support</span>
          <Link to="/dashboard/customer">Open dashboard <FiArrowRight /></Link>
        </div>
      </section>
    </main>
  )
}

export default HomePage
