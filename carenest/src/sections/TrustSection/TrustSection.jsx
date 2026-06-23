import './TrustSection.css'

function TrustSection() {
  return (
    <section className="page-section trust-section" id="trust">
      <div className="section-shell trust-panel">
        <div>
          <p className="eyebrow">Local trust, clear operations</p>
          <h2>Designed for customers and the team behind every order.</h2>
          <p className="lead">
            CareNest combines a polished customer experience with the operational basics needed to
            manage bookings, providers, payments and support.
          </p>
        </div>
        <div className="trust-list">
          <span>Verified provider profiles</span>
          <span>Order status history</span>
          <span>Pickup and delivery windows</span>
          <span>Support-ready customer records</span>
        </div>
      </div>
    </section>
  )
}

export default TrustSection
