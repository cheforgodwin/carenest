export const authValidationMessages = {
  nameRequired: 'Enter your full name.',
  nameInvalid: 'Use letters, spaces, apostrophes, or hyphens for your name.',
  nameTooLong: 'Your name must be 80 characters or fewer.',
  emailRequired: 'Enter your email address.',
  emailInvalid: 'Enter a valid email address, for example name@example.com.',
  emailTooLong: 'Your email address is too long.',
  passwordRequired: 'Enter your password.',
  passwordInvalid: 'Use at least 8 characters with both letters and numbers.',
  passwordWhitespace: 'Your password cannot contain spaces.',
  passwordConfirmationRequired: 'Confirm your password.',
  passwordMismatch: 'The passwords do not match.',
  passwordTooLong: 'Your password must be 128 characters or fewer.',
  phoneInvalid: 'Enter a valid Cameroon number, for example +237 6XX XXX XXX.',
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isValidEmail(email) {
  const value = normalizeEmail(email)
  if (!value || value.length > 254 || /\s|\.\./.test(value)) return false
  const at = value.lastIndexOf('@')
  if (at <= 0 || at !== value.indexOf('@')) return false
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.')) return false
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false
  if (domain.length > 253 || !domain.includes('.')) return false
  const labels = domain.split('.')
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return false
  return /^[a-z]{2,63}$/i.test(labels.at(-1))
}

export function validateEmail(email) {
  const value = normalizeEmail(email)
  if (!value) return authValidationMessages.emailRequired
  if (value.length > 254) return authValidationMessages.emailTooLong
  return isValidEmail(value) ? '' : authValidationMessages.emailInvalid
}

export function validateLoginCredentials({ email, password }) {
  const emailError = validateEmail(email)
  if (emailError) return emailError
  if (!password) return authValidationMessages.passwordRequired
  if (password.length > 128) return authValidationMessages.passwordTooLong
  return ''
}

export function validateSignupFields(profile, isValidPhone) {
  const name = String(profile?.name || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return authValidationMessages.nameRequired
  if (name.length > 80) return authValidationMessages.nameTooLong
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u.test(name)) return authValidationMessages.nameInvalid
  const emailError = validateEmail(profile?.email)
  if (emailError) return emailError
  if (!isValidPhone(profile?.phone)) return authValidationMessages.phoneInvalid
  const password = String(profile?.password || '')
  if (!password) return authValidationMessages.passwordRequired
  if (password.length > 128) return authValidationMessages.passwordTooLong
  if (/\s/.test(password)) return authValidationMessages.passwordWhitespace
  if (password.length < 8 || !/[\p{L}]/u.test(password) || !/\d/.test(password)) return authValidationMessages.passwordInvalid
  if (!profile?.confirmPassword) return authValidationMessages.passwordConfirmationRequired
  if (password !== profile.confirmPassword) return authValidationMessages.passwordMismatch
  return ''
}
