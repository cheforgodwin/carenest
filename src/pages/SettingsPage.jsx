import { deleteOwnAccount } from '../firebase/accountService'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getAuthErrorMessage, getDashboardPath } from '../firebase/authService'
import NotificationControls from '../components/NotificationControls'
import DashboardShell from './dashboards/DashboardShell'
import './SettingsPage.css'

export default function SettingsPage() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  async function leave() {
    setBusy(true); setError('')
    try { await logout(); navigate('/login', { replace: true }) }
    catch (failure) { setError(getAuthErrorMessage(failure)); setBusy(false) }
  }
  async function remove(event) {
    event.preventDefault()
    if (confirmation !== 'DELETE') { setError('Type DELETE to confirm.'); return }
    setBusy(true); setError('')
    try {
      await deleteOwnAccount(user, password, confirmation)
      navigate('/login', { replace: true })
    } catch (failure) { setError(getAuthErrorMessage(failure)); setBusy(false) }
  }
  return <DashboardShell title="Settings" subtitle="Manage your notifications and account." nav={[{ label: 'Dashboard', to: getDashboardPath(profile?.accountType), icon: 'dashboard' }]}>
    <div className="account-settings">
      <section className="dashboard-panel"><h2>Notifications</h2><p>Choose whether this device receives CareNest updates.</p><NotificationControls /></section>
      <section className="dashboard-panel"><h2>Account</h2><p>{profile?.name}</p><p>{user?.email}</p><button type="button" disabled={busy} onClick={leave}>Logout</button></section>
      <section className="dashboard-panel account-deletion"><h2>Delete account</h2><p>Delete your login, profile details and registered notification devices. Order and payment history stays on record. Active orders and unsettled payments must be resolved first.</p>
        {!deleting ? <button type="button" disabled={busy} onClick={() => setDeleting(true)}>Delete my account</button> : <form onSubmit={remove}>
          <p>This action is permanent. Confirm your password and type DELETE to continue.</p>
          <label>Current password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
          <label>Type DELETE<input value={confirmation} onChange={event => setConfirmation(event.target.value)} required autoComplete="off" disabled={busy} /></label>
          <div className="settings-actions"><button type="submit" disabled={busy || confirmation !== 'DELETE'}>{busy ? 'Deleting account...' : 'Permanently delete account'}</button><button type="button" disabled={busy} onClick={() => { setDeleting(false); setPassword(''); setConfirmation(''); setError('') }}>Cancel</button></div>
        </form>}
      </section>
      {error && <p role="alert" className="settings-error">{error}</p>}
    </div>
  </DashboardShell>
}
