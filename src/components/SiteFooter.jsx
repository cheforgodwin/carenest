import { Link, useLocation } from 'react-router-dom'
import { FiMail, FiMessageCircle, FiPhone, FiHelpCircle } from 'react-icons/fi'
import { supportEmail, supportEmailHref, supportPhone, supportPhoneHref, supportWhatsAppHref } from '../config/businessConfig'
import { useI18n } from '../i18n/useI18n.jsx'
import './SiteFooter.css'

const footerCopy = {
  en: { tagline: 'Your home, cared for.', help: 'Help with bookings, payments, providers and deliveries.', explore: 'Explore', home: 'Home', book: 'Book a service', support: 'Help & support', contact: 'Contact support', call: 'Call', privacy: 'Privacy Policy', terms: 'Terms of Service', footer: 'CareNest footer', links: 'CareNest links', policies: 'Policies' },
  fr: { tagline: 'Votre logement, entre de bonnes mains.', help: 'Aide pour les réservations, les paiements, les prestataires et les livraisons.', explore: 'Découvrir', home: 'Accueil', book: 'Réserver un service', support: 'Aide et assistance', contact: 'Contacter l’assistance', call: 'Appeler', privacy: 'Politique de confidentialité', terms: 'Conditions générales d’utilisation', footer: 'Pied de page CareNest', links: 'Liens CareNest', policies: 'Informations légales' },
}

export default function SiteFooter() {
  const { locale } = useI18n()
  const copy = footerCopy[locale] || footerCopy.en
  return <footer id="support" className="site-footer" aria-label={copy.footer} data-no-translate>
    <div className="site-footer-grid">
      <div><Link className="footer-brand" to="/">CareNest</Link><p>{copy.tagline}</p><p>{copy.help}</p></div>
      <nav aria-label={copy.links}><h2>{copy.explore}</h2><Link to="/">{copy.home}</Link><Link to="/dashboard/customer/services">{copy.book}</Link><Link to="/support">{copy.support}</Link></nav>
      <div className="footer-contact"><h2>{copy.contact}</h2><a href={supportWhatsAppHref} target="_blank" rel="noopener noreferrer"><FiMessageCircle aria-hidden="true" /><span>WhatsApp: {supportPhone}</span></a><a href={supportEmailHref}><FiMail aria-hidden="true" /><span>{supportEmail}</span></a><a href={supportPhoneHref}><FiPhone aria-hidden="true" /><span>{copy.call} {supportPhone}</span></a></div>
    </div>
    <div className="footer-bottom"><small>&copy; {new Date().getFullYear()} CareNest</small><nav aria-label={copy.policies}><Link to="/privacy">{copy.privacy}</Link><Link to="/terms">{copy.terms}</Link></nav></div>
  </footer>
}

export function PublicFooter() {
  const { pathname } = useLocation()
  return pathname.startsWith('/dashboard/') ? null : <SiteFooter />
}

export function SupportShortcut() {
  const { locale } = useI18n()
  const { pathname } = useLocation()
  if (pathname === '/support') return null
  return <Link to="/support" className={'support-shortcut' + (pathname.startsWith('/dashboard/customer') ? ' support-shortcut-customer' : '')}><FiHelpCircle aria-hidden="true" /><span data-no-translate>{locale === 'fr' ? 'Assistance' : 'Support'}</span></Link>
}
