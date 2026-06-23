import { Link, NavLink } from 'react-router-dom'
import {
  FiBriefcase,
  FiClipboard,
  FiGift,
  FiHome,
  FiMenu,
  FiPhone,
  FiUser,
  FiWifi,
} from 'react-icons/fi'
import './MobileFrame.css'

function MobileFrame({ title, children, showMenu = false, backTo, rightAction, activeTab = 'home' }) {
  return (
    <main className="mobile-app-page">
      <section className="mobile-phone" aria-label={title ? `${title} screen` : 'CareNest app screen'}>
        <div className="mobile-status">
          <strong>9:41</strong>
          <span>
            <i></i>
            <FiWifi />
            <b></b>
          </span>
        </div>

        {title && (
          <header className="mobile-header">
            {backTo ? (
              <Link className="icon-button" to={backTo} aria-label="Go back">
                <span>&lsaquo;</span>
              </Link>
            ) : showMenu ? (
              <button className="icon-button" type="button" aria-label="Open menu">
                <FiMenu />
              </button>
            ) : (
              <span className="header-spacer"></span>
            )}
            <h1>{title}</h1>
            {rightAction || <span className="header-spacer"></span>}
          </header>
        )}

        <div className="mobile-content">{children}</div>

        <nav className="mobile-tabs" aria-label="Customer app navigation">
          <NavLink className={activeTab === 'home' ? 'active' : ''} to="/customer">
            <FiHome />
            <span>Home</span>
          </NavLink>
          <NavLink className={activeTab === 'orders' ? 'active' : ''} to="/customer/orders/CN-023">
            <FiClipboard />
            <span>Orders</span>
          </NavLink>
          <NavLink className={activeTab === 'services' ? 'active' : ''} to="/customer/services">
            <FiGift />
            <span>Services</span>
          </NavLink>
          <NavLink className={activeTab === 'profile' ? 'active' : ''} to="/login">
            <FiUser />
            <span>Profile</span>
          </NavLink>
        </nav>
      </section>
    </main>
  )
}

export function AppIcon({ name }) {
  const icons = {
    bag: FiBriefcase,
    cleaning: FiGift,
    phone: FiPhone,
    washer: FiClipboard,
  }
  const SelectedIcon = icons[name] || FiGift
  return <SelectedIcon aria-hidden="true" />
}

export default MobileFrame
