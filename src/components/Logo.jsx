import { Link } from 'react-router-dom'
import './Logo.css'

function Logo() {
  return (
    <Link className="brand-lockup" to="/">
      <span className="brand-mark">CN</span>
      <span>
        <strong>CareNest</strong>
        <small>Your home, cared for.</small>
      </span>
    </Link>
  )
}

export default Logo
