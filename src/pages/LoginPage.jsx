import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiLock, FiMail } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import Logo from '../components/Logo'
import { getAuthErrorMessage, getDashboardPath, loginWithEmail, logout } from '../firebase/authService'
import './AuthPages.css'

function LoginPage({ adminOnly = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const profile = await loginWithEmail(form.email, form.password)
      if (!profile) {
        setError('Your account profile was not found. Please contact CareNest support.')
        return
      }
      if (adminOnly && profile.accountType !== 'admin') {
        await logout()
        setSession(null)
        setError('This account is not registered as the CareNest admin.')
        return
      }
      setSession(profile)
      const fallbackPath = adminOnly ? '/dashboard/admin' : getDashboardPath(profile.accountType)
      navigate(location.state?.from || fallbackPath, { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-copy">
          <Logo />
          <p className="eyebrow">{adminOnly ? 'Owner access' : 'Welcome back'}</p>
          <h1>{adminOnly ? 'CareNest admin dashboard.' : 'Login to manage your CareNest requests.'}</h1>
          <p className="lead">{adminOnly ? 'Use the owner account to manage users, providers, orders, and payments.' : 'Enter your email and password to continue.'}</p>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>{adminOnly ? 'Admin login' : 'Login'}</h2>
          <p>{adminOnly ? 'Owner account only.' : 'Access your account.'}</p>
          <label>Email<span className="auth-input"><FiMail /><input name="email" type="email" value={form.email} onChange={updateField} required /></span></label>
          <label>Password<span className="auth-input"><FiLock /><input name="password" type="password" value={form.password} onChange={updateField} required /></span></label>
          {error && <p className="auth-status error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : adminOnly ? 'Open admin dashboard' : 'Login'}</button>
          {!adminOnly && <p className="auth-switch">New to CareNest? <Link to="/signup">Create an account</Link></p>}
        </form>
      </section>
    </main>
  )
}

export default LoginPage
