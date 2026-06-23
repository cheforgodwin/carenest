import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import HowItWorksPage from './pages/HowItWorksPage'
import LoginPage from './pages/LoginPage'
import ServicesPage from './pages/ServicesPage'
import SignupPage from './pages/SignupPage'
import TrustPage from './pages/TrustPage'
import AdminDashboardPage from './pages/dashboards/AdminDashboardPage'
import CustomerDashboardPage from './pages/dashboards/CustomerDashboardPage'
import ProviderDashboardPage from './pages/dashboards/ProviderDashboardPage'
import CustomerHomePage from './pages/customer/CustomerHomePage'
import CustomerServicesPage from './pages/customer/CustomerServicesPage'
import LaundryRequestPage from './pages/customer/LaundryRequestPage'
import OrderTrackingPage from './pages/customer/OrderTrackingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard/customer" element={<CustomerDashboardPage />} />
        <Route path="/dashboard/provider" element={<ProviderDashboardPage />} />
        <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
        <Route path="/customer" element={<CustomerHomePage />} />
        <Route path="/customer/services" element={<CustomerServicesPage />} />
        <Route path="/customer/laundry-request" element={<LaundryRequestPage />} />
        <Route path="/customer/orders/CN-023" element={<OrderTrackingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
