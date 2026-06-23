import { NavLink } from 'react-router-dom'
import { FiBriefcase, FiGrid, FiPlus, FiSettings, FiUsers } from 'react-icons/fi'
import Logo from '../../components/Logo'
import './Dashboard.css'

const icons = { bookings: FiBriefcase, dashboard: FiGrid, settings: FiSettings, users: FiUsers }

function DashboardShell({ title, subtitle, action, metrics, rows, columns, nav }) {
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
          <a href={action.href}><FiPlus />{action.label}</a>
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
