import { Link } from 'react-router-dom'
import { supportPhone } from '../config/businessConfig'

const policies = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Information we collect', 'CareNest processes account contact details, service addresses, bookings, provider applications, profile images, and payment-verification evidence needed to deliver and secure the service.'],
      ['How we use information', 'We use information to operate bookings, assign providers, confirm payments, provide support, prevent fraud, and improve reliability. We do not sell personal information.'],
      ['Storage and access', 'Information is stored using Firebase. Access is restricted by account role. Authorized operations staff may access records when needed to provide support or investigate a transaction.'],
      ['Your choices', 'You may request access, correction, export, or deletion of your account information by contacting CareNest support. Some transaction records may be retained where required for fraud prevention, accounting, or legal obligations.'],
      ['Security and retention', 'CareNest uses access controls and encrypted network connections. Data is retained only while it is reasonably needed for service, safety, dispute resolution, and applicable legal requirements.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using CareNest', 'Provide accurate account, address, booking, and payment information. Do not misuse the service, impersonate another person, submit false payment evidence, or interfere with other users.'],
      ['Bookings and providers', 'Availability and completion times are estimates until a provider accepts a request. CareNest may reassign, reschedule, or cancel a request when service cannot safely be completed.'],
      ['Payments', 'A Mobile Money submission is not considered paid until CareNest verifies the transaction. Cash is due according to the confirmed booking. Suspected duplicate or mismatched transactions may be held for manual review.'],
      ['Cancellations, complaints, and refunds', 'Contact support as early as possible. Refund eligibility depends on payment confirmation, work already completed, provider costs, and the circumstances of the complaint. CareNest will communicate the decision before processing a refund.'],
      ['Account safety', 'You are responsible for protecting your password. CareNest may suspend accounts involved in abuse, fraud, unsafe conduct, or repeated violation of these terms.'],
    ],
  },
}

export default function LegalPage({ type }) {
  const policy = policies[type]
  return (
    <main className="legal-page">
      <Link to="/">← Back to CareNest</Link>
      <h1>{policy.title}</h1>
      <p>Effective date: 16 July 2026. This document should be reviewed for the laws that apply to the final CareNest business entity and service area.</p>
      {policy.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
      <h2>Contact</h2>
      <p>Contact CareNest support{supportPhone ? ` at ${supportPhone}` : ' using the support number shown in the app'} for policy or account requests.</p>
    </main>
  )
}
