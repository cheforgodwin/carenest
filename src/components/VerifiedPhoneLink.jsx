import { useRef, useState } from 'react'
import { PhoneAuthProvider, RecaptchaVerifier, linkWithCredential } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { formatPhoneNumber } from '../firebase/authService'

export default function VerifiedPhoneLink({ phone, onVerified }) {
  const verifierRef = useRef(null)
  const verificationIdRef = useRef('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
    setBusy(true)
    setError('')
    try {
      const currentUser = auth.currentUser
      const e164 = formatPhoneNumber(phone)
      if (!currentUser) throw new Error('Sign in again before verifying your phone.')
      if (!/^\+2376\d{8}$/.test(e164)) throw new Error('Add a valid Cameroon mobile number to your CareNest profile first.')
      if (currentUser.phoneNumber) {
        if (formatPhoneNumber(currentUser.phoneNumber) !== e164) {
          throw new Error('Your account already has a different verified phone number. Contact CareNest support to change it.')
        }
        onVerified(currentUser.phoneNumber)
        return
      }
      if (!verifierRef.current) verifierRef.current = new RecaptchaVerifier(auth, 'peer-delivery-phone-recaptcha', { size: 'invisible' })
      verificationIdRef.current = await new PhoneAuthProvider(auth).verifyPhoneNumber(e164, verifierRef.current)
      setPhase('code')
    } catch (verificationError) {
      verifierRef.current?.clear()
      verifierRef.current = null
      setError(verificationError.message || 'Could not send the verification code.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCode() {
    setBusy(true)
    setError('')
    try {
      const currentUser = auth.currentUser
      if (!currentUser || !verificationIdRef.current) throw new Error('Request a new verification code.')
      if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the six-digit SMS code.')
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, code.trim())
      const linked = await linkWithCredential(currentUser, credential)
      const token = await linked.user.getIdToken(true)
      if (!token || auth.currentUser?.uid !== currentUser.uid) throw new Error('Your account changed. Please sign in again.')
      onVerified(linked.user.phoneNumber)
    } catch (verificationError) {
      setError(verificationError.code === 'auth/credential-already-in-use'
        ? 'This phone number is linked to another CareNest account. Sign in to that account to accept the invitation.'
        : verificationError.message || 'The verification code could not be confirmed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="package-security-note">
      <div>
        <strong>Verify your CareNest phone</strong>
        <p>A one-time SMS check links this number to your signed-in account. CareNest does not receive or store the SMS code.</p>
        {phase === 'idle'
          ? <button type="button" className="table-action" disabled={busy} onClick={sendCode}>{busy ? 'Sending code...' : 'Send verification code'}</button>
          : <div className="package-phone-code"><input aria-label="SMS verification code" inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="button" className="table-action" disabled={busy} onClick={confirmCode}>{busy ? 'Checking...' : 'Verify phone'}</button></div>}
        {error && <p className="package-form-message" role="alert">{error}</p>}
        <div id="peer-delivery-phone-recaptcha" />
      </div>
    </div>
  )
}
