export function normalizePhoneNumber(phone, countryCode = '237') {
  const trimmed = String(phone ?? '').trim()
  if (!trimmed) return ''

  const compact = trimmed.replace(/\s+/g, '')
  const digits = compact.replace(/\D/g, '')
  if (!digits) return ''

  const code = String(countryCode || '237').replace(/\D/g, '')
  let normalizedDigits = digits

  if (normalizedDigits.startsWith(`00${code}`)) {
    normalizedDigits = normalizedDigits.slice(code.length + 2)
  } else if (normalizedDigits.startsWith(code)) {
    normalizedDigits = normalizedDigits.slice(code.length)
  } else if (compact.startsWith('+') && digits.startsWith('237')) {
    normalizedDigits = digits.slice(3)
  }

  if (!normalizedDigits) return ''
  return code ? `+${code}${normalizedDigits}` : `+${normalizedDigits}`
}

export function isValidCameroonPhone(phone, countryCode = '237') {
  return /^\+2376\d{8}$/.test(normalizePhoneNumber(phone, countryCode))
}
