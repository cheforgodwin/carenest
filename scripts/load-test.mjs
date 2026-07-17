import { performance } from 'node:perf_hooks'

const total = Math.max(1, Number(process.argv[2] || 100))
const concurrency = Math.max(1, Number(process.argv[3] || 20))
const project = 'demo-carenest'
const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const dbBase = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`
const runId = Date.now()

function fields(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    typeof value === 'number' ? { integerValue: String(value) } : { stringValue: String(value) },
  ]))
}

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  return response.json()
}

async function simulate(index) {
  const email = `load-${runId}-${index}@example.test`
  const password = 'LoadTest123!'
  const signup = await request(`${authBase}/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${signup.idToken}` }
  await request(`${dbBase}/users/${signup.localId}`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: fields({ uid: signup.localId, email, name: `Load User ${index}`, phone: `+237670${String(index).padStart(6, '0')}`, accountType: 'customer' }) }),
  })
  await request(`${dbBase}/serviceRequests/load-${runId}-${index}`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: fields({ id: `LOAD-${index}`, customerUid: signup.localId, customerEmail: email, serviceType: 'laundry', serviceSpeed: 'Normal', itemSummary: 'Mixed clothes', amount: 3000, status: 'Pending', currentStep: 0, paymentMethod: 'Cash', paymentStatus: 'Pending' }) }),
  })
  await request(`${authBase}/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
}

async function seedAdmin() {
  const email = 'admin@load.test'
  const password = 'LoadAdmin123!'
  let account
  try {
    account = await request(`${authBase}/accounts:signUp?key=fake`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  } catch {
    account = await request(`${authBase}/accounts:signInWithPassword?key=fake`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  }
  await request(`${dbBase}/users/${account.localId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: fields({ uid: account.localId, email, name: 'Load Test Admin', phone: '+237670000000', accountType: 'admin' }) }),
  })
  console.log(`Visible admin login: ${email} / ${password}`)
}

const started = performance.now()
await seedAdmin()
let next = 0
const results = []
let completed = 0
async function worker() {
  while (next < total) {
    const index = next++
    const itemStarted = performance.now()
    try { await simulate(index); results.push({ ok: true, ms: performance.now() - itemStarted }) }
    catch (error) { results.push({ ok: false, ms: performance.now() - itemStarted, error: error.message }) }
    completed += 1
    if (completed % 50 === 0 || completed === total) console.log(`Progress: ${completed}/${total} user flows completed`)
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
const duration = performance.now() - started
const successful = results.filter((item) => item.ok)
const sorted = successful.map((item) => item.ms).sort((a, b) => a - b)
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0
console.log(JSON.stringify({ total, concurrency, succeeded: successful.length, failed: total - successful.length, durationMs: Math.round(duration), flowsPerSecond: Number((successful.length / (duration / 1000)).toFixed(2)), p50Ms: Math.round(percentile(.5)), p95Ms: Math.round(percentile(.95)), firstError: results.find((item) => !item.ok)?.error || null }, null, 2))
if (successful.length !== total) process.exitCode = 1
