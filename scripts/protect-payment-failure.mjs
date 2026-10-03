// One-off, explicit opt-in: add only server-owned failure metadata protection.
import { cert } from 'firebase-admin/app'

export async function protectPaymentFailure() {
  if (process.env.CARENEST_PROTECT_PAYMENT_FAILURE !== '1') return
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
  if (credentials.project_id !== 'carenest-11319') throw new Error('Unexpected Firebase project.')
  const token = await cert(credentials).getAccessToken()
  const project = 'projects/carenest-11319'
  const releaseName = project + '/releases/cloud.firestore'
  const api = 'https://firebaserules.googleapis.com/v1/'
  async function request(path, method = 'GET', body) {
    const response = await fetch(api + path, {
      method, headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20000),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Rules API refused ' + method + ' (HTTP ' + response.status + ').')
    return result
  }
  const current = await request(releaseName)
  if (!current.rulesetName?.startsWith(project + '/rulesets/')) throw new Error('Unexpected ruleset binding.')
  const ruleset = await request(current.rulesetName)
  const files = ruleset.source?.files
  if (!Array.isArray(files)) throw new Error('Rules source unavailable.')
  const marker = "['financialSnapshot', 'paymentFinancials', 'financeTotals'"
  const protectedMarker = "['financialSnapshot', 'paymentFinancials', 'paymentFailureCode', 'financeTotals'"
  let changed = 0
  const updated = files.map(file => {
    if (!file.content?.includes(marker)) return file
    if (file.content.split(marker).length !== 2) throw new Error('Ambiguous protection clause.')
    changed++
    return { ...file, content: file.content.replace(marker, protectedMarker) }
  })
  if (!changed && files.some(file => file.content?.includes(protectedMarker))) {
    console.log('PAYMENT_FAILURE_RULE_ALREADY_PROTECTED')
    return
  }
  if (changed !== 1) throw new Error('Expected server-metadata protection clause not found; live rules were not changed.')
  const created = await request(project + '/rulesets', 'POST', { source: { files: updated } })
  if (!created.name?.startsWith(project + '/rulesets/')) throw new Error('Unexpected created ruleset.')
  const latest = await request(releaseName)
  if (latest.rulesetName !== current.rulesetName) throw new Error('Rules changed concurrently; release was not updated.')
  await request(releaseName, 'PATCH', { release: { name: releaseName, rulesetName: created.name }, updateMask: 'rulesetName' })
  const verified = await request(releaseName)
  if (verified.rulesetName !== created.name) throw new Error('Release verification failed.')
  console.log('PAYMENT_FAILURE_RULE_PROTECTED', JSON.stringify({ previousRuleset: current.rulesetName, ruleset: created.name, unrelatedRulesPreserved: true }))
}
