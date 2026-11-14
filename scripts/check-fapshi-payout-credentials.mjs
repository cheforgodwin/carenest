// Read-only payout-service authentication check. Never initiates a transfer or prints keys/balance.
// Example: node --env-file=.env scripts/check-fapshi-payout-credentials.mjs
import { fapshiPayoutRequest } from '../api/_fapshiPayout.js'

try {
  const { response, config } = await fapshiPayoutRequest('/balance', { allowUnapprovedLive: true })
  if (!response.ok) {
    console.error('Fapshi rejected the payout credential check (HTTP ' + response.status + '). Verify the payout service credential pair and environment.')
    process.exitCode = 1
  } else {
    console.log('Fapshi payout-service credentials accepted for ' + new URL(config.origin).hostname + '. No balance was displayed and no payout was initiated.')
  }
} catch (error) {
  if (error.code === 'PAYOUT_CONFIGURATION_ERROR') {
    console.error(error.message)
  } else {
    const code = String(error?.cause?.code || '')
    const safeCode = /^(?:E[A-Z0-9_]{2,40}|UND_ERR_[A-Z0-9_]{2,40})$/.test(code) ? ' (' + code + ')' : ''
    console.error('Unable to reach Fapshi for the payout credential check.' + safeCode)
  }
  process.exitCode = 1
}