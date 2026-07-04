import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiLock, FiMail } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import Logo from '../components/Logo'
import { getAuthErrorMessage, getDashboardPath, loginWithEmail } from '../firebase/authService'
import './AuthPages.css'

function LoginPage() {
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
      setSession(profile)
      const fallbackPath = getDashboardPath(profile.accountType)
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
          <p className="eyebrow">Welcome back</p>
          <h1>Login to manage your CareNest requests.</h1>
          <p className="lead">Enter your email and password to continue.</p>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Login</h2>
          <p>Access your account.</p>
          <label>Email<span className="auth-input"><FiMail /><input name="email" type="email" value={form.email} onChange={updateField} required /></span></label>
          <label>Password<span className="auth-input"><FiLock /><input name="password" type="password" value={form.password} onChange={updateField} required /></span></label>
          {error && <p className="auth-status error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          <p className="auth-switch">New to CareNest? <Link to="/signup">Create an account</Link></p>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
