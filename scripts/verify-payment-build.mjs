// All diagnostics are opt-in and run only in the trusted server build environment.
import { deleteApp, getApps } from 'firebase-admin/app'
try {
  if (process.env.CARENEST_VERIFY_JOB_QUERY === '1') {
    const { getAdminDb } = await import('../api/_firebaseAdmin.js')
    await getAdminDb().collection('serviceRequests').where('status', '==', 'Pending').where('paymentStatus', '==', 'Paid').limit(1).get()
    console.log('PAID_JOB_QUERY_READY')
  }
  if (process.env.CARENEST_CONFIGURE_MESSAGING === '1') {
    const { configureMessaging } = await import('./configure-messaging.mjs')
    await configureMessaging()
  }
  if (process.env.CARENEST_PROTECT_PAYMENT_FAILURE === '1') {
    const { protectPaymentFailure } = await import('./protect-payment-failure.mjs')
    await protectPaymentFailure()
  }
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
