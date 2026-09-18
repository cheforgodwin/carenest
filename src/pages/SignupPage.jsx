import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiMail, FiPhone, FiUser, FiEye, FiEyeOff } from 'react-icons/fi'
import { useAuth } from '../auth/useAuth'
import { normalizeEmail, validateSignupFields } from '../auth/authValidation.js'
import { phonePlaceholder } from '../config/businessConfig'
import Logo from '../components/Logo'
import { formatPhoneNumber, getAuthErrorMessage, getDashboardPath, isValidCameroonPhone, signUpWithProfile } from '../firebase/authService'
import './AuthPages.css'

function SignupPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
    setError('')
  }

  function normalizeField(event) {
    const { name } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === 'email'
        ? normalizeEmail(current.email)
        : name === 'phone'
          ? formatPhoneNumber(current.phone)
          : current.name.trim().replace(/\s+/g, ' '),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const normalizedForm = {
      ...form,
      name: form.name.trim().replace(/\s+/g, ' '),
      email: normalizeEmail(form.email),
      phone: formatPhoneNumber(form.phone),
    }
    const validationError = validateSignupFields(normalizedForm, isValidCameroonPhone)
    if (validationError) {
      setError(validationError)
      return
    }
    setForm(normalizedForm)
    setLoading(true)
    try {
      const profile = await signUpWithProfile(normalizedForm)
      setSession(profile)
      navigate(getDashboardPath(profile.accountType), { replace: true })
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
          <label>Name<span className="auth-input"><FiUser /><input name="name" autoComplete="name" minLength="2" maxLength="80" value={form.name} onChange={updateField} onBlur={normalizeField} required /></span></label>
          <label>Email<span className="auth-input"><FiMail /><input name="email" type="email" inputMode="email" autoComplete="email" maxLength="254" spellCheck="false" value={form.email} onChange={updateField} onBlur={normalizeField} required /></span></label>
          <label>Telephone number<span className="auth-input"><FiPhone /><input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength="20" value={form.phone} onChange={updateField} onBlur={normalizeField} placeholder={phonePlaceholder} required /></span></label>
          <label>Password<span className="auth-input"><FiLock /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" maxLength="128" value={form.password} onChange={updateField} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></span><small>At least 8 characters with letters and numbers and no spaces.</small></label>
          <label>Confirm password<span className="auth-input"><FiLock /><input name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" maxLength="128" value={form.confirmPassword} onChange={updateField} required /></span></label>
          <label className="auth-consent"><input type="checkbox" required /> <span>I agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the <Link to="/privacy">Privacy Policy</Link>.</span></label>
          {error && <p className="auth-status error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          <p className="auth-switch">Already have an account? <Link to="/login">Login</Link></p>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
