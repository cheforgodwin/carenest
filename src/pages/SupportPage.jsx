import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiMessageCircle, FiMail, FiPhone, FiArrowLeft } from 'react-icons/fi'
import Navbar from '../components/Navbar'
import { supportEmail, supportEmailHref, supportPhone, supportPhoneHref, supportWhatsAppHref } from '../config/businessConfig'
import './SupportPage.css'

export default function SupportPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <><Navbar /><main className="support-page">
    <Link className="support-home-link" to="/"><FiArrowLeft aria-hidden="true" /> CareNest home</Link>
    <p className="eyebrow">WE ARE HERE TO HELP</p><h1>CareNest support</h1><p className="support-intro">Need help with a booking, payment, delivery or your account? Choose how you want to contact us.</p>
    <div className="support-contact-grid">
      <a className="support-contact-card" href={supportWhatsAppHref} target="_blank" rel="noopener noreferrer"><FiMessageCircle aria-hidden="true" /><h2>Chat on WhatsApp</h2><p>Send your question directly to CareNest.</p><strong>{supportPhone}</strong><span>Open WhatsApp</span></a>
      <a className="support-contact-card" href={supportEmailHref}><FiMail aria-hidden="true" /><h2>Email support</h2><p>Write to us about a booking, payment or account issue.</p><strong>{supportEmail}</strong><span>Write an email</span></a>
      <a className="support-contact-card" href={supportPhoneHref}><FiPhone aria-hidden="true" /><h2>Call CareNest</h2><p>Speak with us using the support number below.</p><strong>{supportPhone}</strong><span>Start a call</span></a>
    </div>
    <section className="support-booking-help"><h2>Help with an existing order</h2><p>Include your order number and a short description so we can find the right booking. Never send your Mobile Money PIN, password or verification code.</p><Link to="/dashboard/customer/orders">View my orders</Link></section>
  </main></>
}
