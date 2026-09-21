// Explicit opt-in for a read-only credential check in the deployment environment.
if (process.env.CARENEST_VERIFY_PAYMENT_CONFIG === '1') {
  await import('./check-fapshi-credentials.mjs')
}
