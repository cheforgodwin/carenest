import { Link } from 'react-router-dom'
import { FiDownload } from 'react-icons/fi'
import DashboardLayout from '../../components/DashboardLayout/DashboardLayout'
import { adminBookings, serviceAreas } from '../../data/dashboardData'
import './DashboardPages.css'

const navItems = [
  { label: 'Overview', to: '/dashboard/admin', icon: 'dashboard' },
  { label: 'Bookings', to: '/dashboard/admin', icon: 'bookings' },
  { label: 'Users', to: '/dashboard/admin', icon: 'users' },
  { label: 'Providers', to: '/dashboard/admin', icon: 'providers' },
  { label: 'Settings', to: '/dashboard/admin', icon: 'settings' },
]

function AdminDashboardPage() {
  return (
    <DashboardLayout
      title="Operations Dashboard"
      subtitle="Monitor bookings, customers, providers, payments, and support issues."
      accountType="Admin"
      navItems={navItems}
      actions={<Link to="/dashboard/admin"><FiDownload /> Export</Link>}
    >
      <div className="dashboard-grid">
        <section className="metric-grid">
          <article className="metric-card"><span>Bookings today</span><strong>34</strong><small>+18% vs yesterday</small></article>
          <article className="metric-card"><span>Active providers</span><strong>27</strong><small>5 awaiting review</small></article>
          <article className="metric-card"><span>Revenue</span><strong>420k</strong><small>FCFA this week</small></article>
          <article className="metric-card"><span>Open complaints</span><strong>4</strong><small>2 high priority</small></article>
        </section>

        <section className="dashboard-columns">
          <article className="dashboard-panel">
            <div className="panel-head"><h2>Live bookings</h2><button type="button">Assign provider</button></div>
            <div className="dashboard-table">
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {adminBookings.map(([id, customer, service, status, amount]) => (
                    <tr key={id}><td>{id}</td><td>{customer}</td><td>{service}</td><td><span className="status-chip">{status}</span></td><td>{amount}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="dashboard-list-card">
            <div className="panel-head"><h2>Service areas</h2></div>
            <div className="area-tags">
              {serviceAreas.map((area) => <span key={area}>{area}</span>)}
            </div>
            <ul className="dashboard-list">
              <li><strong>Provider reviews</strong><span>5 pending</span></li>
              <li><strong>Payment disputes</strong><span>2 open</span></li>
              <li><strong>Support queue</strong><span>8 tickets</span></li>
            </ul>
          </article>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default AdminDashboardPage
