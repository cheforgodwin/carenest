import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail, validateLoginCredentials, validateSignupFields } from '../src/auth/authValidation.js'

const validPhone = (phone) => /^\+2376\d{8}$/.test(String(phone).replace(/\s/g, ''))

describe('authentication validation', () => {
  it('normalizes and accepts ordinary email addresses', () => {
    expect(normalizeEmail('  User.Name@Example.COM ')).toBe('user.name@example.com')
    expect(isValidEmail('user.name+care@example.co.uk')).toBe(true)
  })

  it.each(['name@', '@example.com', 'name example@test.com', 'name..two@example.com', 'name@example', 'name@-example.com'])('rejects malformed email %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('requires both login fields', () => {
    expect(validateLoginCredentials({ email: '', password: '' })).toMatch(/email/i)
    expect(validateLoginCredentials({ email: 'person@example.com', password: '' })).toMatch(/password/i)
  })

  it('validates signup identity, phone, and password fields', () => {
    expect(validateSignupFields({ name: 'Marie Ndom', email: 'marie@example.com', phone: '+237612345678', password: 'Secure123', confirmPassword: 'Secure123' }, validPhone)).toBe('')
    expect(validateSignupFields({ name: 'Marie2', email: 'marie@example.com', phone: '+237612345678', password: 'Secure123', confirmPassword: 'Secure123' }, validPhone)).toMatch(/name/i)
    expect(validateSignupFields({ name: 'Marie Ndom', email: 'bad', phone: '+237612345678', password: 'Secure123', confirmPassword: 'Secure123' }, validPhone)).toMatch(/email/i)
    expect(validateSignupFields({ name: 'Marie Ndom', email: 'marie@example.com', phone: '123', password: 'Secure123', confirmPassword: 'Secure123' }, validPhone)).toMatch(/Cameroon/i)
    expect(validateSignupFields({ name: 'Marie Ndom', email: 'marie@example.com', phone: '+237612345678', password: 'password', confirmPassword: 'password' }, validPhone)).toMatch(/letters and numbers/i)
  })
})
