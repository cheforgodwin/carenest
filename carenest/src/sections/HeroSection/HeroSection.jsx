import heroImage from '../../assets/carenest-hero.png'
import { stats } from '../../data/homeData'
import './HeroSection.css'

function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="eyebrow">Home services in one trusted app</p>
          <h1>Laundry, cleaning and home help without the back-and-forth.</h1>
          <p className="lead">
            CareNest helps busy households book verified providers, schedule pickup times, pay
            clearly and track every request from start to finish.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#book">Book a service</a>
            <a className="secondary-action" href="#services">Explore services</a>
          </div>
          <div className="hero-stats" aria-label="CareNest service highlights">
            {stats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-media">
          <img src={heroImage} alt="CareNest home service professional delivering clean laundry" />
          <div className="hero-status">
            <strong>CN-023</strong>
            <span>Laundry pickup confirmed for 10:00 AM</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
