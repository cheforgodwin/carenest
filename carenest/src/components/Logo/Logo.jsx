import { Link } from 'react-router-dom'
import './Logo.css'

function Logo() {
  return (
    <Link className="brand-lockup" to="/" aria-label="CareNest home">
      <svg className="brand-mark" viewBox="0 0 96 96" role="img" aria-label="CareNest logo mark">
        <path className="nest-ring" d="M14 58C18 32 44 15 68 26c12 5 18 17 16 29" />
        <path className="nest-base" d="M16 64c14 17 48 22 70 2-7 18-26 27-45 23-13-3-23-11-25-25Z" />
        <path className="roof" d="M24 52 48 33l28 21" />
        <path className="wall" d="M31 51v18h34V51" />
        <path className="leaf-stem" d="M71 35c6-14 14-18 14-18" />
        <path className="leaf-one" d="M68 29c9-4 16 0 20-11 3 15-7 22-20 11Z" />
        <path className="leaf-two" d="M71 39c-9 4-16 0-20-11-3 15 8 22 20 11Z" />
        <rect x="43" y="53" width="5" height="5" rx="1" />
        <rect x="51" y="53" width="5" height="5" rx="1" />
        <rect x="43" y="61" width="5" height="5" rx="1" />
        <rect x="51" y="61" width="5" height="5" rx="1" />
      </svg>
      <span>
        <strong>CareNest</strong>
        <small>Your home, cared for.</small>
      </span>
    </Link>
  )
}

export default Logo
