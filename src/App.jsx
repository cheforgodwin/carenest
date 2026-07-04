import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CustomerDashboardPage from './pages/dashboards/CustomerDashboardPage'
import ProviderDashboardPage from './pages/dashboards/ProviderDashboardPage'
import AdminDashboardPage from './pages/dashboards/AdminDashboardPage'
import CustomerAppPage from './pages/customer/CustomerAppPage'
import ProtectedRoute from './auth/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard/customer" element={<ProtectedRoute role="customer"><CustomerDashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard/provider" element={<ProtectedRoute role="provider"><ProviderDashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/customer/*" element={<ProtectedRoute role="customer"><CustomerAppPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
