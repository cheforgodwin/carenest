import DOMPurify from 'dompurify'

export const inputLimits = Object.freeze({
  name: 80,
  phone: 20,
  short: 120,
  title: 120,
  address: 240,
  note: 1000,
  description: 2000,
  search: 120,
})

function withoutControlCharacters(value) {
  return [...value].filter((character) => {
    const code = character.charCodeAt(0)
    return code === 9 || code === 10 || code === 13 || code >= 32
  }).join('')
}

export function sanitizeText(value, maxLength = inputLimits.note) {
  const plainText = DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
  return withoutControlCharacters(plainText).slice(0, maxLength)
}

export function sanitizeTrimmedText(value, maxLength = inputLimits.note) {
  return sanitizeText(value, maxLength).trim()
}

export function sanitizeHtml(value) {
  return DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  })
}

export function assertTextLength(value, { field = 'Value', min = 0, max = inputLimits.note } = {}) {
  const text = sanitizeTrimmedText(value, max + 1)
  if (text.length < min) throw new Error(`${field} must contain at least ${min} characters.`)
  if (text.length > max) throw new Error(`${field} must not exceed ${max} characters.`)
  return text
}
