import Navbar from '../components/Navbar/Navbar'
import TrustSection from '../sections/TrustSection/TrustSection'
import './PageLayout.css'

function TrustPage() {
  return (
    <main className="home-page page-route">
      <Navbar />
      <section className="route-hero">
        <div className="section-shell">
          <p className="eyebrow">Trusted home care</p>
          <h1>Built around verified providers and clear support.</h1>
          <p className="lead">
            The platform gives customers confidence while helping operations manage bookings,
            payments and service quality.
          </p>
        </div>
      </section>
      <TrustSection />
    </main>
  )
}

export default TrustPage
