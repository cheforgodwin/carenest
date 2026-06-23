import DashboardShell from './DashboardShell'

function CustomerDashboardPage() {
  return (
    <DashboardShell
      title="Customer Dashboard"
      subtitle="Book services, track orders, and manage payments."
      action={{ label: 'New booking', href: '/customer' }}
      nav={[{ label: 'Overview', to: '/dashboard/customer', icon: 'dashboard' }, { label: 'Bookings', to: '/customer', icon: 'bookings' }, { label: 'Settings', to: '/dashboard/customer', icon: 'settings' }]}
      metrics={[['Active orders', '1'], ['Total bookings', '12'], ['Saved addresses', '3'], ['Spent', '42k']]}
      columns={['Order', 'Service', 'Status', 'Schedule', 'Amount']}
      rows={[['CN-023', 'Laundry', 'In progress', 'Today, 10:00 AM', '3,000 FCFA'], ['CN-021', 'Laundry', 'Completed', '12 May 2024', '3,000 FCFA'], ['CN-018', 'Cleaning', 'Completed', '10 May 2024', '6,000 FCFA']]}
    />
  )
}

export default CustomerDashboardPage
