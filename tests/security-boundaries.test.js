import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('frontend security boundaries', () => {
  it('does not decide that a payment succeeded from initiation data', async () => {
    const source = await readFile(new URL('../src/pages/customer/CustomerAppPage.jsx', import.meta.url), 'utf8')
    expect(source).not.toContain("providerStatus === 'SUCCESSFUL'")
    expect(source).not.toContain('Payment successful')
    expect(source).toContain('only after the payment provider is verified by our server')
  })

  it('contains no raw HTML injection sink', async () => {
    const files = [
      '../src/pages/customer/CustomerAppPage.jsx',
      '../src/i18n/AutoTranslate.jsx',
      '../src/pages/dashboards/AdminDashboardPage.jsx',
      '../src/pages/dashboards/ProviderDashboardPage.jsx',
    ]
    const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')))).join('\n')
    expect(source).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write/)
  })

  it('returns only a neutral accepted response from payment initiation', async () => {
    const source = await readFile(new URL('../api/fapshi.js', import.meta.url), 'utf8')
    expect(source).toContain("status(202)")
    expect(source).toContain("accepted: true")
    expect(source).not.toMatch(/status\(2\d\d\)\.json\(\{\s*status:/)
  })
})
