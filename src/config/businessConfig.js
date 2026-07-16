function parseJsonEnv(name, fallback) {
  const rawValue = import.meta.env[name]
  if (!rawValue) return fallback
  try {
    return JSON.parse(rawValue)
  } catch {
    return fallback
  }
}

function parseListEnv(name) {
  return String(import.meta.env[name] || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

export const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || '').trim()
export const supportPhoneHref = supportPhone ? `tel:${supportPhone.replace(/[^\d+]/g, '')}` : '#'
export const defaultCustomerAddress = String(import.meta.env.VITE_DEFAULT_CUSTOMER_ADDRESS || '').trim()
export const defaultCustomerCity = String(import.meta.env.VITE_DEFAULT_CUSTOMER_CITY || '').trim()
export const phoneCountryCode = String(import.meta.env.VITE_PHONE_COUNTRY_CODE || '').replace(/\D/g, '')
export const phonePlaceholder = String(import.meta.env.VITE_PHONE_PLACEHOLDER || '').trim()
export const serviceAreaPlaceholder = String(import.meta.env.VITE_SERVICE_AREA_PLACEHOLDER || '').trim()
export const serviceAddresses = parseListEnv('VITE_SERVICE_ADDRESSES')

export const servicePrices = parseJsonEnv('VITE_SERVICE_PRICES_JSON', {
  laundry: { serviceOptions: {}, primaryOptions: {} },
  cleaning: { serviceOptions: {}, primaryOptions: {} },
  delivery: { serviceOptions: {}, primaryOptions: {} },
})

export function getStartingPrice(serviceType) {
  const prices = Object.values(servicePrices[serviceType]?.primaryOptions || {})
    .map(Number)
    .filter((amount) => amount > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}
