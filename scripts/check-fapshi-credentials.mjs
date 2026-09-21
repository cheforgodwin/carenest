// Read-only authentication check. Never initiates a payment or prints keys/balances.
// Use explicit environment loading, e.g. node --env-file=.env scripts/check-fapshi-credentials.mjs.
import { getFapshiBaseUrl, getFapshiConfig } from '../api/_fapshi.js'

try {
  const { apiUrl, apiUser, apiKey } = getFapshiConfig()
  const response = await fetch(getFapshiBaseUrl(apiUrl) + '/balance', {
    headers: { apiuser: apiUser, apikey: apiKey },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  await response.body?.cancel()
  if (!response.ok) {
    console.error('Fapshi rejected the credential check (HTTP ' + response.status + '). Verify the selected environment and its matching API user/key.')
    process.exitCode = 1
  } else {
    console.log('Fapshi credentials accepted for ' + new URL(apiUrl).hostname + '. No payment was initiated. Direct Pay activation is a separate check.')
  }
} catch (error) {
  console.error(error.code === 'PAYMENT_CONFIGURATION_ERROR' ? error.message : 'Unable to reach Fapshi for the authentication check.')
  process.exitCode = 1
}
