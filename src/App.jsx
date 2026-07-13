import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProviderDashboardPage from './pages/dashboards/ProviderDashboardPage'
import AdminDashboardPage from './pages/dashboards/AdminDashboardPage'
import CustomerAppPage from './pages/customer/CustomerAppPage'
import ProtectedRoute from './auth/ProtectedRoute'

function LegacyCustomerRedirect() {
  const location = useLocation()
  const suffix = location.pathname.replace(/^\/customer/, '')
  return <Navigate to={`/dashboard/customer${suffix}${location.search}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/carenest-admin" element={<LoginPage adminOnly />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard/customer/*" element={<ProtectedRoute role="customer"><CustomerAppPage /></ProtectedRoute>} />
        <Route path="/dashboard/provider" element={<ProtectedRoute role="provider"><ProviderDashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/customer/*" element={<LegacyCustomerRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
