// All diagnostics are opt-in and run only in the trusted server build environment.
import { deleteApp, getApps } from 'firebase-admin/app'
try {
  if (process.env.CARENEST_VERIFY_PAYMENT_CONFIG === '1') {
    await import('./check-fapshi-credentials.mjs')
  }
  if (process.env.CARENEST_PAYMENT_DIAGNOSTICS === '1') {
    const { runPaymentDiagnostics } = await import('./payment-diagnostics.mjs')
    await runPaymentDiagnostics()
  }
  if (process.env.CARENEST_ALLOW_LIVE_PAYMENT_TEST === '1') {
    await import('./production-payment-smoke.mjs')
  }
} finally {
  await Promise.all(getApps().map((app) => deleteApp(app)))
}
