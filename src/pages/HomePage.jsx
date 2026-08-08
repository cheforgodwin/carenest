import { FiArrowRight, FiCheckCircle, FiClock, FiHeadphones, FiShield } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useT } from '../i18n/I18nContext.jsx'
import './HomePage.css'

const serviceKeys = ['home.service.laundry', 'home.service.homeCleaning', 'home.service.essentialsDelivery', 'home.service.repairs']

function HomePage() {
  const heroEyebrow = useT('home.hero.eyebrow')
  const heroHeadline = useT('home.hero.headline')
  const heroLead = useT('home.hero.lead')
  const createAccount = useT('home.hero.createAccount')
  const bookService = useT('home.hero.bookService')
  const statusTitle = useT('home.hero.statusTitle')
  const statusState = useT('home.hero.statusState')
  const statusDescription = useT('home.hero.statusDescription')
  const servicesEyebrow = useT('home.services.eyebrow')
  const servicesHeadline = useT('home.services.headline')
  const servicesDescription = useT('home.services.description')
  const howEyebrow = useT('home.how.eyebrow')
  const howHeadline = useT('home.how.headline')
  const verifiedProviders = useT('home.how.verifiedProviders')
  const fastService = useT('home.how.fastService')
  const supportLabel = useT('home.how.support')
  const openDashboard = useT('home.how.openDashboard')
  const serviceNames = serviceKeys.map((serviceKey) => useT(serviceKey))

  return (
    <main className="home-page">
      <Navbar />
      <section className="hero">
        <div>
          <p className="eyebrow">{heroEyebrow}</p>
          <h1>{heroHeadline}</h1>
          <p className="lead">{heroLead}</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/signup">{createAccount}</Link>
            <Link className="secondary-action" to="/dashboard/customer">{bookService}</Link>
          </div>
        </div>
        <div className="hero-card">
          <strong>{statusTitle}</strong>
          <span>{statusState}</span>
          <p>{statusDescription}</p>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">{servicesEyebrow}</p>
          <h2>{servicesHeadline}</h2>
        </div>
        <div className="service-grid">
          {serviceKeys.map((serviceKey, index) => (
            <article key={serviceKey}>
              <FiCheckCircle />
              <h3>{serviceNames[index]}</h3>
              <p>{servicesDescription}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section dark-section" id="how">
        <div className="section-heading">
          <p className="eyebrow">{howEyebrow}</p>
          <h2>{howHeadline}</h2>
        </div>
        <div className="trust-grid">
          <span><FiShield /> {verifiedProviders}</span>
          <span><FiClock /> {fastService}</span>
          <span><FiHeadphones /> {supportLabel}</span>
          <Link to="/dashboard/customer">{openDashboard} <FiArrowRight /></Link>
        </div>
      </section>
    </main>
  )
}

export default HomePage
