import { Link } from 'react-router-dom'
import { FiPlus } from 'react-icons/fi'
import DashboardLayout from '../../components/DashboardLayout/DashboardLayout'
import { customerOrders } from '../../data/dashboardData'
import './DashboardPages.css'

const navItems = [
  { label: 'Overview', to: '/dashboard/customer', icon: 'dashboard' },
  { label: 'Bookings', to: '/dashboard/customer', icon: 'bookings' },
  { label: 'Payments', to: '/dashboard/customer', icon: 'earnings' },
  { label: 'Settings', to: '/dashboard/customer', icon: 'settings' },
]

function CustomerDashboardPage() {
  return (
    <DashboardLayout
      title="Customer Dashboard"
      subtitle="Book services, track orders, and manage home care payments."
      accountType="Customer"
      navItems={navItems}
      actions={<Link to="/customer/laundry-request"><FiPlus /> New booking</Link>}
    >
      <div className="dashboard-grid">
        <section className="metric-grid">
          <article className="metric-card"><span>Active orders</span><strong>1</strong><small>Laundry in progress</small></article>
          <article className="metric-card"><span>Total bookings</span><strong>12</strong><small>+3 this month</small></article>
          <article className="metric-card"><span>Saved addresses</span><strong>3</strong><small>Bastos default</small></article>
          <article className="metric-card"><span>Total spent</span><strong>42k</strong><small>FCFA tracked</small></article>
        </section>

        <section className="insight-strip">
          <article className="dashboard-panel wide-panel">
            <div className="panel-head">
              <h2>Current order</h2>
              <span className="status-chip">In progress</span>
            </div>
            <h2>Laundry Order CN-023</h2>
            <p>Pickup today at 10:00 AM. Your clothes are currently washing and will move to ironing next.</p>
            <Link className="status-chip" to="/customer/orders/CN-023">Track order</Link>
          </article>
          <article className="dashboard-list-card">
            <div className="panel-head"><h2>Quick services</h2></div>
            <ul className="dashboard-list">
              <li><strong>Laundry</strong><span>From 2,000 FCFA</span></li>
              <li><strong>Cleaning</strong><span>From 5,000 FCFA</span></li>
              <li><strong>Essentials</strong><span>Fast delivery</span></li>
            </ul>
          </article>
        </section>

        <section className="dashboard-panel">
          <div className="panel-head"><h2>Recent bookings</h2><Link to="/customer">Mobile view</Link></div>
          <div className="dashboard-table">
            <table>
              <thead><tr><th>Order</th><th>Service</th><th>Status</th><th>Schedule</th><th>Amount</th></tr></thead>
              <tbody>
                {customerOrders.map(([id, service, status, schedule, amount]) => (
                  <tr key={id}><td>{id}</td><td>{service}</td><td><span className="status-chip">{status}</span></td><td>{schedule}</td><td>{amount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

export default CustomerDashboardPage
