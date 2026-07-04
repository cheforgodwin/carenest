import { Link, NavLink, useNavigate } from 'react-router-dom'
import { FiBriefcase, FiGrid, FiLogOut, FiPlus, FiSettings, FiUsers } from 'react-icons/fi'
import { useAuth } from '../../auth/useAuth'
import Logo from '../../components/Logo'
import './Dashboard.css'

const icons = { bookings: FiBriefcase, dashboard: FiGrid, settings: FiSettings, users: FiUsers }

function DashboardShell({ title, subtitle, action, metrics, rows, columns, nav }) {
  const navigate = useNavigate()
  const { logout, profile } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Logo />
        <nav>
          {nav.map((item) => {
            const Icon = icons[item.icon] || FiGrid
            return <NavLink key={item.label} to={item.to}><Icon /><span>{item.label}</span></NavLink>
          })}
        </nav>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-top">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="dashboard-actions">
            <div className="dashboard-user">
              <strong>{profile?.name || 'CareNest user'}</strong>
              <span>{profile?.accountType || 'account'}</span>
            </div>
            <Link to={action.href}><FiPlus />{action.label}</Link>
            <button type="button" onClick={handleLogout}><FiLogOut />Logout</button>
          </div>
        </header>
        <section className="metric-grid">
          {metrics.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </section>
        <section className="dashboard-panel">
          <h2>Recent activity</h2>
          <table className="dashboard-table">
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 2 ? <span className="status-chip">{cell}</span> : cell}</td>)}</tr>)}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  )
}

export default DashboardShell
