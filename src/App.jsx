import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CustomerDashboardPage from './pages/dashboards/CustomerDashboardPage'
import ProviderDashboardPage from './pages/dashboards/ProviderDashboardPage'
import AdminDashboardPage from './pages/dashboards/AdminDashboardPage'
import CustomerAppPage from './pages/customer/CustomerAppPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard/customer" element={<CustomerDashboardPage />} />
        <Route path="/dashboard/provider" element={<ProviderDashboardPage />} />
        <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
        <Route path="/customer/*" element={<CustomerAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
