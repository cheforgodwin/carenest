import { Link } from 'react-router-dom'
import { supportEmail, supportEmailHref, supportPhone, supportWhatsAppHref } from '../config/businessConfig'

const policies = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Information CareNest handles', 'When you create an account, CareNest handles your name, email address, telephone number, account role, and sign-in information managed by Firebase Authentication. To arrange a service, CareNest handles the service address, requested service, booking details, instructions, status history, and relevant customer, provider, and rider contact details. Provider and rider applications and storefront listings include the information you submit in those forms.'],
      ['Payments and orders', 'CareNest records order amounts, payment method, payment status, transaction references, and the mobile-money phone number you provide for an approval request. Payments are processed or verified through the payment provider shown at checkout. CareNest does not ask for or store your mobile-money PIN. Payment and order records may be retained after account deletion for accounting, fraud prevention, dispute handling, and legal obligations.'],
      ['Notifications and device data', 'If you choose to enable browser push notifications, CareNest stores a push token associated with your account and role so it can send order, payment, and job-status updates to that device. Notification content may be visible on your lock screen. You can disable push notifications in Settings or in your browser or device settings. CareNest also uses Firebase services, browser storage for necessary preferences, and Firebase Analytics where supported to operate and understand use of the app.'],
      ['How information is used and shared', 'CareNest uses information to create and manage accounts, coordinate bookings, route orders to providers or riders, verify payments, send requested notifications, provide support, protect the service, and meet legal obligations. Booking details and contact information are shared with the provider or rider assigned to fulfil that booking. Information is also processed by service providers used to run CareNest, including Firebase and the payment provider involved in a transaction. CareNest does not sell personal information. Active storefront listings are visible to visitors; do not publish private information in a listing.'],
      ['Access, correction, and deletion', 'Contact CareNest support to request access to or correction of your account information or to request account deletion. Deleting an account removes sign-in access and disables that account’s notification devices and provider listings. Order and payment history may be retained where needed for accounting, safety, disputes, fraud prevention, or legal obligations. You can withdraw browser notification permission at any time through Settings or your browser or device settings.'],
      ['Security and retention', 'CareNest uses role-based access controls and encrypted network connections, but no internet service can guarantee absolute security. Information is kept for as long as reasonably needed to provide services, maintain required records, resolve disputes, prevent abuse, and comply with applicable law.'],
      ['Updates and contact', 'CareNest may update this policy when its services or legal obligations change. The current version and effective date appear on this page. For privacy questions or requests, contact CareNest using the details below.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['About CareNest and eligibility', 'CareNest provides an app and website to help customers request home services and essentials, and to help approved providers and riders manage related work. You must provide accurate account information, be able to enter into these terms, and use the service in accordance with applicable law. Keep your password and sign-in devices secure.'],
      ['Bookings and service fulfilment', 'A request is not confirmed until the app shows its accepted or assigned status. Prices, availability, pickup windows, delivery times, and completion estimates may change until a provider accepts the request. CareNest may help coordinate or reassign a booking, or cancel it when it cannot safely or reasonably be fulfilled. Tell CareNest promptly if booking details are wrong or a service is not completed as agreed.'],
      ['Providers, riders, and storefronts', 'Providers and riders must use their approved accounts, keep listing and service information accurate, and fulfil accepted work safely and professionally. Storefront prices, options, service areas, and stock are provided by the listing provider and may change; a listing is not an order confirmation. CareNest may hide listings or restrict accounts to protect users, investigate reports, or enforce these terms.'],
      ['Payments, fees, and verification', 'The price and payment options shown for a request apply to that booking. A Mobile Money or other electronic payment request is not considered paid until its status is verified by CareNest. Approve payment only on the phone and for the amount shown in your order. Never share your mobile-money PIN with CareNest or a provider. Cash payments, where offered, are due according to the accepted booking. Suspected duplicate, incomplete, or mismatched transactions may be paused for review.'],
      ['Cancellations, complaints, and refunds', 'Contact CareNest support as early as possible if you need to cancel or report a problem. Refund eligibility and amount depend on payment confirmation, the work already performed, provider costs, and the circumstances of the request, subject to applicable consumer rights. CareNest will communicate its decision before processing an approved refund.'],
      ['Optional notifications', 'Browser push notifications are optional and require your permission. If enabled, CareNest may send order, payment, and job-availability or status updates relevant to your account role. Delivery depends on your browser, device, network, and notification settings and is not guaranteed; check your dashboard for the authoritative order or payment status. Disable notifications in CareNest Settings or your browser or device settings.'],
      ['Acceptable use and account action', 'Do not impersonate another person, submit false payment information, misuse another user’s contact details, interfere with the service, or engage in abusive, fraudulent, or unsafe conduct. CareNest may limit, suspend, or close an account or listing where reasonably necessary to protect users, investigate suspected misuse, or enforce these terms.'],
      ['Service availability, changes, and legal rights', 'CareNest works to keep the service available but does not promise uninterrupted or error-free access. Nothing in these terms removes rights that cannot be excluded under applicable law. CareNest may update the service or these terms; material updates will be posted here with a revised effective date. Continued use after an update takes effect means you accept the revised terms, to the extent permitted by law.'],
    ],
  },
}

export default function LegalPage({ type }) {
  const policy = policies[type]
  return (
    <main className="legal-page">
      <Link to="/">← Back to CareNest</Link>
      <h1>{policy.title}</h1>
      <p>Effective date: 4 October 2026. These terms and policy describe CareNest’s current app features. They should be reviewed by qualified local counsel for the final business entity and applicable laws.</p>
      {policy.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
      <h2>Contact</h2>
      <p>For support, policy or account requests, email <a href={supportEmailHref}>{supportEmail}</a> or contact us on <a href={supportWhatsAppHref}>WhatsApp: {supportPhone}</a>.</p>
    </main>
  )
}
