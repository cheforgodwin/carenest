import Icon from '../../components/Icon/Icon'
import { services } from '../../data/homeData'
import './ServicesSection.css'

function ServicesSection() {
  return (
    <section className="page-section services-section" id="services">
      <div className="section-shell">
        <div className="section-heading center">
          <p className="eyebrow">Everyday home care</p>
          <h2>Book the help your home needs in minutes.</h2>
          <p className="lead">
            One account for pickup, delivery, provider updates, payment records and support.
          </p>
        </div>
        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.name}>
              <Icon name={service.icon} />
              <h3>{service.name}</h3>
              <p>{service.detail}</p>
              <span>{service.price}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ServicesSection
