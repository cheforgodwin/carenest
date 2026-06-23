import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import './Navbar.css'

function Navbar() {
  return (
    <header className="site-header">
      <nav className="navbar">
        <Logo />
        <div className="nav-links">
          <a href="#services">Services</a>
          <a href="#how">How it works</a>
          <NavLink to="/dashboard/customer">Dashboard</NavLink>
        </div>
        <div className="nav-auth">
          <NavLink to="/login">Login</NavLink>
          <Link className="nav-cta" to="/signup">Sign up</Link>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
