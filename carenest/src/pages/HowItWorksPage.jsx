import Navbar from '../components/Navbar/Navbar'
import AppPreview from '../sections/AppPreview/AppPreview'
import HowItWorks from '../sections/HowItWorks/HowItWorks'
import './PageLayout.css'

function HowItWorksPage() {
  return (
    <main className="home-page page-route">
      <Navbar />
      <section className="route-hero">
        <div className="section-shell">
          <p className="eyebrow">Simple order flow</p>
          <h1>From request to delivery, every step is visible.</h1>
          <p className="lead">
            CareNest keeps customers, providers and support teams working from the same order
            timeline.
          </p>
        </div>
      </section>
      <HowItWorks />
      <AppPreview />
    </main>
  )
}

export default HowItWorksPage
