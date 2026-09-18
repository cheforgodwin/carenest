import { describe, expect, it } from 'vitest'
import { uiEnglishText } from '../src/i18n/uiTextCatalog.js'

describe('UI translation catalog', () => {
  it('covers every major CareNest workspace', () => {
    expect(uiEnglishText).toEqual(expect.arrayContaining([
      'Create account',
      'Your home, cared for.',
      'Provider Dashboard',
      'Rider Dashboard',
      'Operations Dashboard',
      'Payment reviews',
      'Provider applications',
      'Save availability',
    ]))
  })

  it('does not contain malformed source-code fragments', () => {
    expect(uiEnglishText.some((text) => text.includes("order.serviceType ==="))).toBe(false)
  })
})
