import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { FiMenu, FiX } from 'react-icons/fi'
import Logo from './Logo'
import { appVersion } from '../config/appVersion'
import { useI18n, useT } from '../i18n/I18nContext.jsx'
import './Navbar.css'

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { locale, setLocale, supportedLocales } = useI18n()
  const servicesLabel = useT('navbar.services')
  const howLabel = useT('navbar.how')
  const loginLabel = useT('navbar.login')
  const signupLabel = useT('navbar.signup')
  const languageLabel = useT('navbar.language')

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
            <a href="#services" onClick={() => setIsMenuOpen(false)}>{servicesLabel}</a>
            <a href="#how" onClick={() => setIsMenuOpen(false)}>{howLabel}</a>
          </div>
          <div className="nav-version">v{appVersion}</div>
          <div className="nav-auth">
            <a className="nav-language" aria-label={languageLabel}>
              <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                {supportedLocales.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
              </select>
            </a>
            <NavLink to="/login" onClick={() => setIsMenuOpen(false)}>{loginLabel}</NavLink>
            <Link className="nav-cta" to="/signup" onClick={() => setIsMenuOpen(false)}>{signupLabel}</Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
