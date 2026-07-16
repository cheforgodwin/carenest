import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiMail, FiPhone, FiUser } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import { phonePlaceholder } from '../config/businessConfig'
import Logo from '../components/Logo'
import { getAuthErrorMessage, getDashboardPath, signUpWithProfile } from '../firebase/authService'
import './AuthPages.css'

function SignupPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    accountType: 'customer',
  })
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
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      const profile = await signUpWithProfile(form)
      setSession(profile)
      navigate(getDashboardPath(profile.accountType))
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
          <p className="eyebrow">Create account</p>
          <h1>Join CareNest and book trusted home services faster.</h1>
          <p className="lead">Create your profile with your contact details and account type.</p>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Sign up</h2>
          <p>Set up your CareNest profile.</p>
          <label>Name<span className="auth-input"><FiUser /><input name="name" value={form.name} onChange={updateField} required /></span></label>
          <label>Email<span className="auth-input"><FiMail /><input name="email" type="email" value={form.email} onChange={updateField} required /></span></label>
          <label>Telephone number<span className="auth-input"><FiPhone /><input name="phone" type="tel" value={form.phone} onChange={updateField} placeholder={phonePlaceholder} required /></span></label>
          <label>Password<span className="auth-input"><FiLock /><input name="password" type="password" minLength="6" value={form.password} onChange={updateField} required /></span></label>
          {error && <p className="auth-status error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          <p className="auth-switch">Already have an account? <Link to="/login">Login</Link></p>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
