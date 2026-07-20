import { Navigate, useLocation } from 'react-router-dom'
import { getDashboardPath } from '../firebase/authService'
import { useAuth } from './useAuth'

function ProtectedRoute({ children, role }) {
  const location = useLocation()
  const { loading, profile, user } = useAuth()

  if (loading) {
    return <main className="route-loader">Loading CareNest...</main>
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!user.emailVerified && profile.accountType !== 'admin') {
    return <Navigate to="/verify-email" replace />
  }

  if (role && profile.accountType !== role) {
    return <Navigate to={getDashboardPath(profile.accountType)} replace />
  }

  return children
}

export default ProtectedRoute
