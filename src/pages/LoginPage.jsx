import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiLock, FiMail, FiEye, FiEyeOff } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import { normalizeEmail, validateEmail, validateLoginCredentials } from '../auth/authValidation.js'
import Logo from '../components/Logo'
import { getAuthErrorMessage, getDashboardPath, loginWithEmail, logout, requestPasswordReset } from '../firebase/authService'
import { useI18n } from '../i18n/useI18n.jsx'
import './AuthPages.css'

function LoginPage({ adminOnly = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const { dictionary } = useI18n()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
    setError('')
    setMessage('')
  }

  function normalizeEmailField() {
    setForm((current) => ({ ...current, email: normalizeEmail(current.email) }))
  }

  async function handlePasswordReset() {
    setError('')
    setMessage('')
    const validationError = validateEmail(form.email)
    if (validationError) {
      setError(validationError)
      return
    }
    try {
      await requestPasswordReset(form.email)
      setMessage(dictionary['login.message.resetSent'])
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    const validationError = validateLoginCredentials(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    try {
      const profile = await loginWithEmail(form.email, form.password)
      if (!profile) {
        setError(dictionary['login.error.notFound'])
        return
      }
      if (adminOnly && profile.accountType !== 'admin') {
        await logout()
        setSession(null)
        setError(dictionary['login.error.notAdmin'])
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
          <p className="eyebrow">{dictionary[adminOnly ? 'login.eyebrow.owner' : 'login.eyebrow.user']}</p>
          <h1>{dictionary[adminOnly ? 'login.headline.admin' : 'login.headline.user']}</h1>
          <p className="lead">{dictionary[adminOnly ? 'login.lead.admin' : 'login.lead.user']}</p>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>{dictionary[adminOnly ? 'login.heading.admin' : 'login.heading.user']}</h2>
          <p>{dictionary[adminOnly ? 'login.description.admin' : 'login.description.user']}</p>
          <label>{dictionary['login.label.email']}<span className="auth-input"><FiMail /><input name="email" type="email" inputMode="email" autoComplete="email" maxLength="254" spellCheck="false" value={form.email} onChange={updateField} onBlur={normalizeEmailField} aria-invalid={Boolean(error && validateEmail(form.email))} required /></span></label>
          <label>{dictionary['login.label.password']}<span className="auth-input"><FiLock /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength="128" value={form.password} onChange={updateField} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></span></label>
          {error && <p className="auth-status error" role="alert">{error}</p>}
          {message && <p className="auth-status" role="status">{message}</p>}
          <button type="submit" disabled={loading}>{dictionary[loading ? 'login.button.loggingIn' : adminOnly ? 'login.button.openAdminDashboard' : 'login.button.login']}</button>
          {!adminOnly && <button className="auth-link-button" type="button" onClick={handlePasswordReset}>{dictionary['login.button.forgotPassword']}</button>}
          {!adminOnly && <p className="auth-switch">{dictionary['login.link.newTo']} <Link to="/signup">{dictionary['login.link.createAccount']}</Link></p>}
        </form>
      </section>
    </main>
  )
}

export default LoginPage
