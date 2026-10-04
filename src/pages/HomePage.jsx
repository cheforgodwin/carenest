import { useEffect, useMemo, useState } from 'react'
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiHeadphones,
  FiHome,
  FiMapPin,
  FiPackage,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiTool,
  FiTruck,
  FiUserCheck,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { formatMarketplaceAmount, getMarketplaceCategory } from '../config/marketplaceConfig'
import Navbar from '../components/Navbar'
import { ListingCardSkeleton } from '../components/ContentSkeletons'
import { useI18n, useT } from '../i18n/useI18n.jsx'
import { filterMarketplaceListings } from '../utils/marketplaceSearch'
import './HomePage.css'

const serviceCards = [
  { key: 'home.service.laundry', image: '/images/services/laundry.webp', icon: FiShoppingBag, to: '/dashboard/customer/request/laundry' },
  { key: 'home.service.homeCleaning', image: '/images/services/cleaning.webp', icon: FiTool, to: '/dashboard/customer/request/cleaning' },
  { key: 'home.service.essentialsDelivery', image: '/images/services/essentials.webp', icon: FiPackage, to: '/dashboard/customer/request/delivery' },
  { key: 'home.service.repairs', icon: FiTool, to: '/dashboard/customer/services', comingSoon: true },
]

const steps = [
  { icon: FiCheckCircle, title: 'Choose a service', copy: 'Pick the home service that fits your needs.' },
  { icon: FiCalendar, title: 'Book a time', copy: 'Share your details and a convenient schedule.' },
  { icon: FiUserCheck, title: 'Meet your provider', copy: 'A local provider accepts and prepares your request.' },
  { icon: FiHome, title: 'Enjoy a cared-for home', copy: 'Follow progress and get help whenever you need it.' },
]

function HomePage() {
  const { locale } = useI18n()
  const [marketplaceListings, setMarketplaceListings] = useState([])
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('')
  const [marketplaceListingsLoading, setMarketplaceListingsLoading] = useState(true)
  const [marketplaceListingsError, setMarketplaceListingsError] = useState('')
  const heroEyebrow = useT('home.hero.eyebrow')
  const heroHeadline = useT('home.hero.headline')
  const heroLead = useT('home.hero.lead')
  const createAccount = useT('home.hero.createAccount')
  const bookService = useT('home.hero.bookService')
  const exploreServices = useT('home.hero.exploreServices')
  const heroImageAlt = useT('home.hero.imageAlt')
  const statusTitle = useT('home.hero.statusTitle')
  const statusState = useT('home.hero.statusState')
  const statusDescription = useT('home.hero.statusDescription')
  const servicesEyebrow = useT('home.services.eyebrow')
  const servicesHeadline = useT('home.services.headline')
  const servicesDescription = useT('home.services.description')
  const howEyebrow = useT('home.how.eyebrow')
  const fastService = useT('home.how.fastService')
  const supportLabel = useT('home.how.support')
  const serviceLaundry = useT('home.service.laundry')
  const serviceHomeCleaning = useT('home.service.homeCleaning')
  const serviceEssentialsDelivery = useT('home.service.essentialsDelivery')
  const serviceRepairs = useT('home.service.repairs')
  const serviceComingSoon = useT('home.service.comingSoon')
  const stepsEyebrow = useT('home.steps.eyebrow')
  const stepsHeadline = useT('home.steps.headline')
  const trustEyebrow = useT('home.trust.eyebrow')
  const trustHeadline = useT('home.trust.headline')
  const trustProviders = useT('home.trust.providers')
  const trustConvenience = useT('home.trust.convenience')
  const trustLocal = useT('home.trust.local')
  const trustPayments = useT('home.trust.payments')
  const lifestyleHeadline = useT('home.lifestyle.headline')
  const lifestyleLead = useT('home.lifestyle.lead')
  const lifestyleImageAlt = useT('home.lifestyle.imageAlt')
  const finalHeadline = useT('home.final.headline')
  const finalLead = useT('home.final.lead')
  const finalAction = useT('home.final.action')
  const serviceNames = [serviceLaundry, serviceHomeCleaning, serviceEssentialsDelivery, serviceRepairs]
  const filteredMarketplaceListings = useMemo(
    () => filterMarketplaceListings(marketplaceListings, marketplaceSearchQuery, locale),
    [locale, marketplaceListings, marketplaceSearchQuery],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadMarketplaceListings() {
      try {
        const response = await fetch('/api/marketplace', { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load storefronts.')
        if (!Array.isArray(payload.listings)) throw new Error('The storefront response was invalid.')
        setMarketplaceListings(payload.listings)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMarketplaceListingsError('Storefront listings are temporarily unavailable. Please try again later.')
        }
      } finally {
        if (!controller.signal.aborted) setMarketplaceListingsLoading(false)
      }
    }

    loadMarketplaceListings()
    return () => controller.abort()
  }, [])

  return (
    <main className="home-page">
      <Navbar />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{heroEyebrow}</p>
          <h1>{heroHeadline}</h1>
          <p className="lead">{heroLead}</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/dashboard/customer/services">{bookService} <FiArrowRight /></Link>
            <Link className="secondary-action" to="/signup">{createAccount} <FiArrowRight /></Link>
            <a className="hero-explore-link" href="#services">{exploreServices}</a>
          </div>
          <div className="hero-assurance"><FiShield /> {trustProviders} <span /> <FiClock /> {trustConvenience}</div>
        </div>
        <div className="hero-visual">
          <img src="/images/services/cleaning.webp" alt={heroImageAlt} width="1280" height="800" fetchPriority="high" decoding="async" />
          <div className="hero-visual-shade" />
          <div className="hero-card">
            <span className="hero-card-icon"><FiCheckCircle /></span>
            <div><strong>{statusTitle}</strong><span className="hero-status-pill">{statusState}</span></div>
            <p>{statusDescription}</p>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">{servicesEyebrow}</p>
          <h2>{servicesHeadline}</h2>
          <p className="section-description">{servicesDescription}</p>
        </div>
        <div className="service-grid">
          {serviceCards.map((service, index) => {
            const Icon = service.icon
            return (
              <article className={`landing-service-card${service.comingSoon ? ' coming-soon' : ''}`} key={service.key}>
                {service.image
                  ? <img className="landing-service-image" src={service.image} alt={serviceNames[index]} width="640" height="400" loading="lazy" decoding="async" />
                  : <div className="landing-service-coming-image"><Icon /><span>{serviceComingSoon}</span></div>}
                <div className="landing-service-copy">
                  <span className="landing-service-icon"><Icon /></span>
                  <h3>{serviceNames[index]}</h3>
                  <p>{service.comingSoon ? serviceComingSoon : servicesDescription}</p>
                  {!service.comingSoon && <Link to={service.to}>{exploreServices} <FiArrowRight /></Link>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="section public-marketplace-section" id="marketplace">
        <div className="section-heading">
          <p className="eyebrow">CareNest marketplace</p>
          <h2>Find what your home needs.</h2>
          <p className="section-description">Search products and services from active local provider storefronts.</p>
        </div>
        <label className="public-marketplace-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            value={marketplaceSearchQuery}
            onChange={(event) => setMarketplaceSearchQuery(event.target.value)}
            placeholder="Search shops, products, and services"
            aria-label="Search shops, products, and services"
          />
        </label>
        <div className="public-marketplace-grid">
          {marketplaceListingsLoading
            ? Array.from({ length: 3 }, (_, index) => <ListingCardSkeleton key={index} />)
            : filteredMarketplaceListings.map((listing) => (
              <article className="public-marketplace-card" key={listing.firestoreId}>
                <span>{getMarketplaceCategory(listing.category).label}</span>
                <h3>{listing.title}</h3>
                <p>{listing.description}</p>
                <small>Sold by {listing.providerName} · {listing.serviceArea}</small>
                {listing.turnaround && <small>{listing.turnaround}</small>}
                <strong>{formatMarketplaceAmount(listing.price)} / {listing.unit}</strong>
                {listing.stockTracked && <small>{listing.stockQuantity > 0 ? `${listing.stockQuantity} available` : 'Out of stock'}</small>}
                <Link to="/login">Sign in to order <FiArrowRight /></Link>
              </article>
            ))}
          {!marketplaceListingsLoading && marketplaceListingsError && <p className="public-marketplace-message" role="alert">{marketplaceListingsError}</p>}
          {!marketplaceListingsLoading && !marketplaceListingsError && marketplaceListings.length === 0 && <p className="public-marketplace-message">Provider storefronts are coming soon.</p>}
          {!marketplaceListingsLoading && !marketplaceListingsError && marketplaceListings.length > 0 && filteredMarketplaceListings.length === 0 && <p className="public-marketplace-message">No matching listings. Try a different search.</p>}
        </div>
      </section>

      <section className="section process-section" id="how">
        <div className="section-heading">
          <p className="eyebrow">{stepsEyebrow}</p>
          <h2>{stepsHeadline}</h2>
        </div>
        <div className="steps-grid">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <article className="step-card" key={title}>
              <span className="step-number">0{index + 1}</span>
              <span className="step-icon"><Icon /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section trust-section">
        <div className="section-heading">
          <p className="eyebrow">{trustEyebrow}</p>
          <h2>{trustHeadline}</h2>
        </div>
        <div className="trust-grid">
          <article><FiShield /><strong>{trustProviders}</strong></article>
          <article><FiCheckCircle /><strong>{trustConvenience}</strong></article>
          <article><FiMapPin /><strong>{trustLocal}</strong></article>
          <article><FiShoppingBag /><strong>{trustPayments}</strong></article>
          <Link to="/support"><FiHeadphones /><strong>{supportLabel}</strong><FiArrowRight /></Link>
        </div>
      </section>

      <section className="lifestyle-section">
        <div className="lifestyle-image">
          <img src="/images/services/laundry.webp" alt={lifestyleImageAlt} width="1280" height="800" loading="lazy" decoding="async" />
          <span><FiTruck /> {fastService}</span>
        </div>
        <div className="lifestyle-copy">
          <p className="eyebrow">{howEyebrow}</p>
          <h2>{lifestyleHeadline}</h2>
          <p>{lifestyleLead}</p>
          <Link className="primary-action" to="/dashboard/customer/services">{bookService} <FiArrowRight /></Link>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <p className="eyebrow">{servicesEyebrow}</p>
          <h2>{finalHeadline}</h2>
          <p>{finalLead}</p>
        </div>
        <Link className="primary-action" to="/dashboard/customer/services">{finalAction} <FiArrowRight /></Link>
      </section>
    </main>
  )
}

export default HomePage
