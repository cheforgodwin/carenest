import { Link } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'
import MobileFrame, { AppIcon } from '../../components/MobileApp/MobileFrame'
import { customerServices } from '../../data/customerAppData'
import './CustomerApp.css'

function CustomerServicesPage() {
  return (
    <MobileFrame title="Services" activeTab="services">
      <p className="screen-subtitle">Choose a service to get started</p>
      <div className="services-list">
        {customerServices.map((service) => (
          <article className={`service-showcase ${service.tone}`} key={service.title}>
            <div className="service-visual"><AppIcon name={service.icon} /></div>
            <div>
              <h2>{service.title}</h2>
              <p>{service.description}</p>
              <Link to={service.title === 'Laundry Service' ? '/customer/laundry-request' : '/customer/services'}>
                Book Now <FiArrowRight />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </MobileFrame>
  )
}

export default CustomerServicesPage
