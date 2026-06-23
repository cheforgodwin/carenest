import { steps } from '../../data/homeData'
import './HowItWorks.css'

function HowItWorks() {
  return (
    <section className="page-section how-section" id="how-it-works">
      <div className="section-shell how-grid">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>Clear steps from request to delivery.</h2>
          <p className="lead">
            CareNest keeps customers, providers and support teams aligned around one order status.
          </p>
        </div>
        <div className="step-list">
          {steps.map(([title, detail], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
