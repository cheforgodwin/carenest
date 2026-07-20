import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Logo from '../components/Logo'
import { getDashboardPath, refreshEmailVerification, resendVerificationEmail } from '../firebase/authService'
import './AuthPages.css'

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [status, setStatus] = useState({ loading: false, error: '', message: '' })

  async function checkVerification() {
    setStatus({ loading: true, error: '', message: '' })
    try {
      const verified = await refreshEmailVerification()
      if (!verified) {
        setStatus({ loading: false, error: 'Your email is not verified yet. Open the link in your inbox, then check again.', message: '' })
        return
      }
      navigate(getDashboardPath(profile?.accountType), { replace: true })
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: '' })
    }
  }

  async function resend() {
    setStatus({ loading: true, error: '', message: '' })
    try {
      await resendVerificationEmail()
      setStatus({ loading: false, error: '', message: 'Verification email sent again. Check your inbox and spam folder.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: '' })
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-copy"><Logo /><p className="eyebrow">Secure your account</p><h1>Verify your email before using CareNest.</h1><p className="lead">We sent a verification link to {user?.email || 'your email address'}.</p></div>
        <section className="auth-card">
          <h2>Check your inbox</h2>
          <p>Open the verification link, then return here.</p>
          {status.error && <p className="auth-status error" role="alert">{status.error}</p>}
          {status.message && <p className="auth-status" role="status">{status.message}</p>}
          <button type="button" onClick={checkVerification} disabled={status.loading}>I have verified my email</button>
          <button className="auth-link-button" type="button" onClick={resend} disabled={status.loading}>Resend verification email</button>
        </section>
      </section>
    </main>
  )
}

export default VerifyEmailPage
