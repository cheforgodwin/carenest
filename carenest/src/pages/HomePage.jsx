import Navbar from '../components/Navbar/Navbar'
import AppPreview from '../sections/AppPreview/AppPreview'
import BookingBar from '../sections/BookingBar/BookingBar'
import HeroSection from '../sections/HeroSection/HeroSection'
import HowItWorks from '../sections/HowItWorks/HowItWorks'
import ServicesSection from '../sections/ServicesSection/ServicesSection'
import TrustSection from '../sections/TrustSection/TrustSection'
import './HomePage.css'

function HomePage() {
  return (
    <main className="home-page" id="home">
      <Navbar />
      <HeroSection />
      <BookingBar />
      <ServicesSection />
      <HowItWorks />
      <AppPreview />
      <TrustSection />
    </main>
  )
}

export default HomePage
