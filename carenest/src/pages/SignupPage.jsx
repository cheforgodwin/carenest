import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiPhone, FiUser, FiUsers } from 'react-icons/fi'
import Logo from '../components/Logo/Logo'
import {
  createUserProfile,
  getDashboardPath,
  saveAuthSession,
} from '../firebase/authService'
import './AuthPages.css'

function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    accountType: 'customer',
  })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setStatus('')

    if (!form.name.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!form.phone.trim()) {
      setError('Please enter your telephone number.')
      return
    }

    setLoading(true)

    try {
      const profile = await createUserProfile(form)
      saveAuthSession(profile)
      setStatus('Account created successfully.')
      navigate(getDashboardPath(profile.accountType))
    } catch (authError) {
      setError(authError.message || 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-copy">
          <Logo />
          <p className="eyebrow">Create your account</p>
          <h1>Join CareNest and book trusted home services faster.</h1>
          <p className="lead">
            Create your profile with your name, telephone number and account type.
          </p>
          <div className="auth-highlights">
            <span>Fast booking</span>
            <span>Verified providers</span>
            <span>Track every request</span>
          </div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-head">
            <h2>Sign up</h2>
            <p>Set up your CareNest profile.</p>
          </div>

          <label>
            Name
            <span className="auth-input">
              <FiUser />
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                autoComplete="name"
                value={form.name}
                onChange={updateField}
                required
              />
            </span>
          </label>

          <label>
            Telephone number
            <span className="auth-input">
              <FiPhone />
              <input
                type="tel"
                name="phone"
                placeholder="+237 6XX XXX XXX"
                autoComplete="tel"
                value={form.phone}
                onChange={updateField}
                required
              />
            </span>
          </label>

          <label>
            Account type
            <span className="auth-input">
              <FiUsers />
              <select name="accountType" value={form.accountType} onChange={updateField}>
                <option value="customer">Customer</option>
                <option value="provider">Service provider</option>
                <option value="admin">Admin / operations</option>
              </select>
            </span>
          </label>

          {status && <p className="auth-status success">{status}</p>}
          {error && <p className="auth-status error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Create account'}
          </button>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
