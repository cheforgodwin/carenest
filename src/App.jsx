import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProtectedRoute from './auth/ProtectedRoute'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ProviderDashboardPage = lazy(() => import('./pages/dashboards/ProviderDashboardPage'))
const AdminDashboardPage = lazy(() => import('./pages/dashboards/AdminDashboardPage'))
const CustomerAppPage = lazy(() => import('./pages/customer/CustomerAppPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))

function LegacyCustomerRedirect() {
  const location = useLocation()
  const suffix = location.pathname.replace(/^\/customer/, '')
  return <Navigate to={`/dashboard/customer${suffix}${location.search}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<main className="system-message"><p>Loading CareNest…</p></main>}><Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/carenest-admin" element={<LoginPage adminOnly />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/dashboard/customer/*" element={<ProtectedRoute role="customer"><CustomerAppPage /></ProtectedRoute>} />
        <Route path="/dashboard/provider" element={<ProtectedRoute role="provider"><ProviderDashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/customer/*" element={<LegacyCustomerRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </BrowserRouter>
  )
}

export default App
