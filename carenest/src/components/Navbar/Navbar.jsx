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
        <div className="nav-auth">
          <NavLink className="nav-login" to="/login">Login</NavLink>
          <Link className="nav-cta" to="/signup">Sign up</Link>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
