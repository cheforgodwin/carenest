import { Link, useLocation } from 'react-router-dom'
import { FiMail, FiMessageCircle, FiPhone, FiHelpCircle } from 'react-icons/fi'
import { supportEmail, supportEmailHref, supportPhone, supportPhoneHref, supportWhatsAppHref } from '../config/businessConfig'
import './SiteFooter.css'

export default function SiteFooter() {
  return <footer id="support" className="site-footer" aria-label="CareNest footer">
    <div className="site-footer-grid">
      <div><Link className="footer-brand" to="/">CareNest</Link><p>Your home, cared for.</p><p>Help with bookings, payments, providers and deliveries.</p></div>
      <nav aria-label="CareNest links"><h2>Explore</h2><Link to="/">Home</Link><Link to="/dashboard/customer/services">Book a service</Link><Link to="/support">Help &amp; support</Link></nav>
      <div className="footer-contact"><h2>Contact support</h2><a href={supportWhatsAppHref} target="_blank" rel="noopener noreferrer"><FiMessageCircle aria-hidden="true" /><span>WhatsApp: {supportPhone}</span></a><a href={supportEmailHref}><FiMail aria-hidden="true" /><span>{supportEmail}</span></a><a href={supportPhoneHref}><FiPhone aria-hidden="true" /><span>Call {supportPhone}</span></a></div>
    </div>
    <div className="footer-bottom"><small>&copy; {new Date().getFullYear()} CareNest</small><nav aria-label="Policies"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link></nav></div>
  </footer>
}

export function PublicFooter() {
  const { pathname } = useLocation()
  return pathname.startsWith('/dashboard/') ? null : <SiteFooter />
}

export function SupportShortcut() {
  const { pathname } = useLocation()
  if (pathname === '/support') return null
  return <Link to="/support" className={'support-shortcut' + (pathname.startsWith('/dashboard/customer') ? ' support-shortcut-customer' : '')}><FiHelpCircle aria-hidden="true" /><span>Support</span></Link>
}
