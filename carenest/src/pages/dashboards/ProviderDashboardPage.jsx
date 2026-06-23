import { Link } from 'react-router-dom'
import { FiCalendar } from 'react-icons/fi'
import DashboardLayout from '../../components/DashboardLayout/DashboardLayout'
import { providerJobs } from '../../data/dashboardData'
import './DashboardPages.css'

const navItems = [
  { label: 'Overview', to: '/dashboard/provider', icon: 'dashboard' },
  { label: 'Jobs', to: '/dashboard/provider', icon: 'jobs' },
  { label: 'Earnings', to: '/dashboard/provider', icon: 'earnings' },
  { label: 'Availability', to: '/dashboard/provider', icon: 'settings' },
]

function ProviderDashboardPage() {
  return (
    <DashboardLayout
      title="Provider Dashboard"
      subtitle="Accept jobs, manage availability, and monitor service earnings."
      accountType="Service Provider"
      navItems={navItems}
      actions={<Link to="/dashboard/provider"><FiCalendar /> Set availability</Link>}
    >
      <div className="dashboard-grid">
        <section className="metric-grid">
          <article className="metric-card"><span>Open jobs</span><strong>7</strong><small>3 urgent</small></article>
          <article className="metric-card"><span>Active jobs</span><strong>2</strong><small>Due today</small></article>
          <article className="metric-card"><span>Rating</span><strong>4.8</strong><small>36 reviews</small></article>
          <article className="metric-card"><span>Earnings</span><strong>86k</strong><small>FCFA this month</small></article>
        </section>

        <section className="dashboard-columns">
          <article className="dashboard-panel">
            <div className="panel-head"><h2>Job requests</h2><button type="button">Filter</button></div>
            <div className="dashboard-table">
              <table>
                <thead><tr><th>Job</th><th>Type</th><th>Status</th><th>Area</th><th>Payout</th></tr></thead>
                <tbody>
                  {providerJobs.map(([id, type, status, area, payout]) => (
                    <tr key={id}><td>{id}</td><td>{type}</td><td><span className="status-chip">{status}</span></td><td>{area}</td><td>{payout}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="dashboard-list-card">
            <div className="panel-head"><h2>Today</h2></div>
            <ul className="dashboard-list">
              <li><strong>10:00 AM</strong><span>Laundry pickup, Mvog-Ada</span></li>
              <li><strong>1:30 PM</strong><span>Deep clean, Bastos</span></li>
              <li><strong>4:00 PM</strong><span>Drop-off, Odza</span></li>
            </ul>
          </article>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default ProviderDashboardPage
