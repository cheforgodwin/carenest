import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { FiMenu, FiX } from 'react-icons/fi'
import Logo from './Logo'
import './Navbar.css'

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <header className={`site-header ${isMenuOpen ? 'nav-open' : ''}`}>
      <nav className="navbar">
        <Logo />
        <button
          className="nav-toggle"
          type="button"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="site-navigation"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <FiX /> : <FiMenu />}
        </button>
        <div className="nav-menu" id="site-navigation">
          <div className="nav-links">
            <a href="#services" onClick={() => setIsMenuOpen(false)}>Services</a>
            <a href="#how" onClick={() => setIsMenuOpen(false)}>How it works</a>
          </div>
          <div className="nav-auth">
            <NavLink to="/login" onClick={() => setIsMenuOpen(false)}>Login</NavLink>
            <Link className="nav-cta" to="/signup" onClick={() => setIsMenuOpen(false)}>Sign up</Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
