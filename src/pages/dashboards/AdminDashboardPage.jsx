import DashboardShell from './DashboardShell'

function AdminDashboardPage() {
  return (
    <DashboardShell
      title="Operations Dashboard"
      subtitle="Monitor bookings, users, providers, payments, and support."
      action={{ label: 'Export', href: '/dashboard/admin' }}
      nav={[{ label: 'Overview', to: '/dashboard/admin', icon: 'dashboard' }, { label: 'Users', to: '/dashboard/admin', icon: 'users' }, { label: 'Settings', to: '/dashboard/admin', icon: 'settings' }]}
      metrics={[['Bookings today', '34'], ['Providers', '27'], ['Revenue', '420k'], ['Complaints', '4']]}
      columns={['Order', 'Customer', 'Status', 'Service', 'Amount']}
      rows={[['CN-051', 'John Doe', 'In progress', 'Laundry', '3,000 FCFA'], ['CN-050', 'Mary N.', 'Pending', 'Cleaning', '7,500 FCFA'], ['CN-049', 'Eric T.', 'Complaint', 'Repairs', '15,000 FCFA']]}
    />
  )
}

export default AdminDashboardPage
