import { Link, NavLink } from 'react-router-dom'
import Logo from '../Logo/Logo'
import './Navbar.css'

function Navbar() {
  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <Logo />
        <div className="nav-links">
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/trust">Trust</NavLink>
        </div>
        <Link className="nav-cta" to="/#book">Book now</Link>
      </nav>
    </header>
  )
}

export default Navbar
