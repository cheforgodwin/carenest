import { NavLink } from 'react-router-dom'
import {
  FiBell,
  FiBriefcase,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiHome,
  FiLogOut,
  FiSettings,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import Logo from '../Logo/Logo'
import './DashboardLayout.css'

const iconMap = {
  bookings: FiClipboard,
  dashboard: FiGrid,
  earnings: FiCreditCard,
  home: FiHome,
  jobs: FiBriefcase,
  providers: FiShield,
  settings: FiSettings,
  users: FiUsers,
}

function DashboardLayout({ children, title, subtitle, accountType, navItems, actions }) {
  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Logo />
        <nav className="dashboard-nav" aria-label={`${accountType} dashboard navigation`}>
          {navItems.map((item) => {
            const Icon = iconMap[item.icon] || FiGrid
            return (
              <NavLink key={item.label} to={item.to}>
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <NavLink className="dashboard-logout" to="/login">
          <FiLogOut />
          <span>Logout</span>
        </NavLink>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p>{accountType}</p>
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>
          <div className="dashboard-actions">
            {actions}
            <button type="button" aria-label="Notifications">
              <FiBell />
            </button>
          </div>
        </header>
        {children}
      </section>
    </main>
  )
}

export default DashboardLayout
