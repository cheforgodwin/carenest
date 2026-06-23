import DashboardShell from './DashboardShell'

function ProviderDashboardPage() {
  return (
    <DashboardShell
      title="Provider Dashboard"
      subtitle="Accept jobs, manage availability, and monitor earnings."
      action={{ label: 'Set availability', href: '/dashboard/provider' }}
      nav={[{ label: 'Overview', to: '/dashboard/provider', icon: 'dashboard' }, { label: 'Jobs', to: '/dashboard/provider', icon: 'bookings' }, { label: 'Settings', to: '/dashboard/provider', icon: 'settings' }]}
      metrics={[['Open jobs', '7'], ['Active jobs', '2'], ['Rating', '4.8'], ['Earnings', '86k']]}
      columns={['Job', 'Type', 'Status', 'Area', 'Payout']}
      rows={[['CN-041', 'Deep cleaning', 'Pending', 'Bastos', '9,000 FCFA'], ['CN-039', 'Laundry pickup', 'Active', 'Mvog-Ada', '3,500 FCFA'], ['CN-036', 'Electrical support', 'Scheduled', 'Odza', '12,000 FCFA']]}
    />
  )
}

export default ProviderDashboardPage
