import Navbar from '../components/Navbar/Navbar'
import BookingBar from '../sections/BookingBar/BookingBar'
import ServicesSection from '../sections/ServicesSection/ServicesSection'
import './PageLayout.css'

function ServicesPage() {
  return (
    <main className="home-page page-route">
      <Navbar />
      <section className="route-hero">
        <div className="section-shell">
          <p className="eyebrow">CareNest services</p>
          <h1>Choose the home service you need today.</h1>
          <p className="lead">
            Start with laundry, cleaning, essentials delivery or repairs, then schedule the time
            that works for your home.
          </p>
        </div>
      </section>
      <BookingBar />
      <ServicesSection />
    </main>
  )
}

export default ServicesPage
