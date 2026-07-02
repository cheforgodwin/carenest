import DashboardShell from './DashboardShell'

function CustomerDashboardPage() {
  const rows = [
    ['CN-023', 'Laundry', 'In progress', 'Today, 10:00 AM', '3,000 FCFA'],
    ['CN-021', 'Laundry', 'Completed', '12 May 2024', '3,000 FCFA'],
    ['CN-018', 'Cleaning', 'Completed', '10 May 2024', '6,000 FCFA'],
  ]

  const activeOrders = rows.filter((row) => row[2].toLowerCase() !== 'completed').length
  const totalSpent = rows.reduce((total, row) => total + Number(row[4].replace(/\D/g, '')), 0)
  const formattedSpent = `${totalSpent.toLocaleString()} FCFA`

  return (
    <DashboardShell
      title="Customer Dashboard"
      subtitle="Book services, track orders, and manage payments."
      action={{ label: 'New booking', href: '/customer' }}
      nav={[{ label: 'Overview', to: '/dashboard/customer', icon: 'dashboard' }, { label: 'Bookings', to: '/customer', icon: 'bookings' }, { label: 'Settings', to: '/dashboard/customer', icon: 'settings' }]}
      metrics={[['Active orders', String(activeOrders)], ['Total orders', String(rows.length)], ['Saved addresses', '3'], ['Total spent', formattedSpent]]}
      columns={['Order', 'Service', 'Status', 'Schedule', 'Amount']}
      rows={rows}
    />
  )
}

export default CustomerDashboardPage
