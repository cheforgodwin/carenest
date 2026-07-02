import { Link } from 'react-router-dom'
import './Logo.css'

function Logo({ to = '/', compact = false, className = '' }) {
  return (
    <Link className={`cn-logo ${compact ? 'cn-logo--compact' : ''} ${className}`.trim()} to={to}>
      <span className="cn-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 96 96" role="img">
          <path className="cn-logo-swoosh" d="M13 62c10 19 32 28 55 21 9-3 16-8 21-15-9 29-47 36-70 14-5-5-8-12-6-20Z" />
          <path className="cn-logo-arc" d="M16 32c18-21 48-25 70-7" />
          <path className="cn-logo-leaf" d="M74 22c10-9 17-9 20-9-1 8-4 16-13 20-4-3-6-7-7-11Z" />
          <path className="cn-logo-roof" d="M18 48 48 25l31 23" />
          <path className="cn-logo-chimney" d="M27 39V25h8v8" />
          <rect className="cn-logo-window" x="45" y="38" width="5" height="5" />
          <rect className="cn-logo-window" x="53" y="38" width="5" height="5" />
          <rect className="cn-logo-window" x="45" y="46" width="5" height="5" />
          <rect className="cn-logo-window" x="53" y="46" width="5" height="5" />
          <rect className="cn-logo-washer" x="24" y="52" width="20" height="26" rx="3" />
          <circle className="cn-logo-washer-door" cx="34" cy="66" r="7" />
          <path className="cn-logo-broom" d="M69 48 66 70M59 72h15l-5 11H55l4-11Z" />
          <rect className="cn-logo-towel-orange" x="47" y="59" width="20" height="6" rx="3" />
          <rect className="cn-logo-towel-green" x="47" y="68" width="24" height="6" rx="3" />
          <rect className="cn-logo-towel-green" x="47" y="77" width="21" height="6" rx="3" />
        </svg>
      </span>
      <span className="cn-logo-copy">
        <strong>Care<span>Nest</span></strong>
        <small>Your home, cared for.</small>
      </span>
    </Link>
  )
}

export default Logo
