// Cameroon Mobile Money prefixes: https://docs.netwalletpay.com/netwallet-api-docs/reference/mobile-money-operator-prefixes
// Keep detection shared by checkout and the API. Prefix detection does not verify account ownership or balance.
export const unsupportedPaymentPhoneMessage = 'Enter a supported Cameroon MTN MoMo or Orange Money number. Unknown networks are not supported.'

export function normalizePaymentPhone(value) {
  const input = String(value ?? '').trim()
  if (!/^\+?[\d\s().-]+$/.test(input)) return ''
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('00237')) digits = digits.slice(5)
  else if (digits.startsWith('237')) digits = digits.slice(3)
  else if (input.startsWith('+')) return ''
  return /^6\d{8}$/.test(digits) ? digits : ''
}

export function detectPaymentNetwork(value) {
  const phone = normalizePaymentPhone(value)
  if (/^(67|68|65[0-4])/.test(phone)) return 'mtn'
  if (/^(69|65[5-9])/.test(phone)) return 'orange'
  return ''
}

export function paymentNetworkLabel(value) {
  const network = detectPaymentNetwork(value)
  return network === 'mtn' ? 'MTN MoMo' : network === 'orange' ? 'Orange Money' : 'Enter a supported MTN or Orange number'
}
