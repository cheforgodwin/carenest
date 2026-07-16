import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FiBriefcase, FiCreditCard, FiGrid, FiLogOut, FiMenu, FiPlus, FiSettings, FiUsers, FiX } from 'react-icons/fi'
import { useAuth } from '../../auth/useAuth'
import Logo from '../../components/Logo'
import './Dashboard.css'

const icons = { bookings: FiBriefcase, dashboard: FiGrid, payments: FiCreditCard, settings: FiSettings, users: FiUsers }

function DashboardShell({
  title,
  subtitle,
  action,
  metrics = [],
  rows = [],
  columns = [],
  nav = [],
  panelTitle = 'Recent activity',
  children,
  emptyMessage = 'No records yet.',
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, profile } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className={`dashboard-page ${isMenuOpen ? 'dashboard-menu-open' : ''}`}>
      <button
        className="dashboard-menu-backdrop"
        type="button"
        aria-label="Close dashboard menu"
        onClick={() => setIsMenuOpen(false)}
      />
      <aside className="dashboard-sidebar" id="dashboard-navigation">
        <Logo />
        <nav>
          {nav.map((item) => {
            const Icon = icons[item.icon] || FiGrid
            const target = item.to
            const current = `${location.pathname}${location.search}`
            const isQueryLink = target.includes('?')
            const isActiveQuery = current === target
            if (isQueryLink) {
              return (
                <button
                  className={isActiveQuery ? 'active' : ''}
                  key={item.label}
                  type="button"
                  onClick={() => {
                    navigate(target)
                    setIsMenuOpen(false)
                  }}
                >
                  <Icon /><span>{item.label}</span>
                </button>
              )
            }
            return (
              <NavLink
                className={({ isActive }) => isActive ? 'active' : ''}
                key={item.label}
                onClick={() => setIsMenuOpen(false)}
                to={target}
              >
                <Icon /><span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-top">
          <div>
            <button
              className="dashboard-menu-toggle"
              type="button"
              aria-label={isMenuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
              aria-expanded={isMenuOpen}
              aria-controls="dashboard-navigation"
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              {isMenuOpen ? <FiX /> : <FiMenu />}
            </button>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="dashboard-actions">
            <div className="dashboard-user">
              <strong>{profile?.name || 'CareNest user'}</strong>
              <span>{profile?.accountType || 'account'}</span>
            </div>
            {action?.onClick
              ? <button className="dashboard-action-button" type="button" onClick={action.onClick}><FiPlus />{action.label}</button>
              : <Link to={action.href}><FiPlus />{action.label}</Link>}
            <button type="button" onClick={handleLogout}><FiLogOut />Logout</button>
          </div>
        </header>
        {metrics.length > 0 && (
          <section className="metric-grid">
            {metrics.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </section>
        )}
        {children || (
          <section className="dashboard-panel">
            <h2>{panelTitle}</h2>
            {rows.length > 0 ? (
              <table className="dashboard-table">
                <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 2 ? <span className="status-chip">{cell}</span> : cell}</td>)}</tr>)}
                </tbody>
              </table>
            ) : <p className="dashboard-empty">{emptyMessage}</p>}
          </section>
        )}
      </section>
    </main>
  )
}

export default DashboardShell
