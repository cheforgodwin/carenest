export function normalizePhoneNumber(phone, countryCode = '237') {
  const trimmed = String(phone ?? '').trim()
  if (!trimmed) return ''

  const compact = trimmed.replace(/\s+/g, '')
  const digits = compact.replace(/\D/g, '')
  if (!digits) return ''

  const code = String(countryCode || '237').replace(/\D/g, '')
  if (compact.startsWith('+')) return `+${digits}`
  if (code && digits.startsWith(code)) return `+${digits}`
  return code ? `+${code}${digits}` : `+${digits}`
}

export function isValidCameroonPhone(phone, countryCode = '237') {
  return /^\+2376\d{8}$/.test(normalizePhoneNumber(phone, countryCode))
}
