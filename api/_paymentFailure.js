// Classify only explicit provider evidence; never expose raw provider responses.
export function paymentFailureCode(payment) {
  const reason = payment?.reason
  const values = [payment?.message, ...(typeof reason === 'string' ? [reason] : reason && typeof reason === 'object' ? ['code', 'message', 'error', 'description', 'reason'].map(key => reason[key]) : [])]
  const text = values.filter(value => typeof value === 'string').join(' ').replace(/[_-]+/g, ' ').toLowerCase()
  return /\b(?:insufficient|not enough|low)\s+(?:funds?|balance)\b|\bbalance\s+(?:is\s+)?(?:too low|insufficient)\b|\b(?:solde insuffisant|fonds insuffisants)\b/.test(text) ? 'INSUFFICIENT_FUNDS' : 'UNKNOWN'
}
