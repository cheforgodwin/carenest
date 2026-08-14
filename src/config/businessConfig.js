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

const defaultServiceAddresses = [
  'Bastos, Yaounde',
  'Mvog-Ada, Yaounde',
  'Odza, Yaounde',
  'Bonamoussadi, Douala',
]

const defaultServicePrices = {
  laundry: {
    serviceOptions: { Normal: 0, Express: 1500 },
    primaryOptions: { 'Mixed clothes': 3000, 'Shirts and trousers': 2500, 'Beddings and towels': 4500, 'Large family load': 6500 },
  },
  cleaning: {
    serviceOptions: { Standard: 0, 'Deep Clean': 4000 },
    primaryOptions: { Studio: 5000, '1 Bedroom': 7000, '2 Bedrooms': 10000, '3+ Bedrooms': 14000 },
  },
  delivery: {
    serviceOptions: { Standard: 0, Priority: 1000 },
    primaryOptions: { Groceries: 2500, 'Household essentials': 3000, Pharmacy: 3500, 'Custom errand': 4500 },
  },
}

function normalizeServicePrices(config) {
  return Object.fromEntries(Object.entries(defaultServicePrices).map(([service, defaults]) => [
    service,
    {
      serviceOptions: { ...defaults.serviceOptions, ...(config?.[service]?.serviceOptions || {}) },
      primaryOptions: { ...defaults.primaryOptions, ...(config?.[service]?.primaryOptions || {}) },
    },
  ]))
}

export const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || '').trim()
export const supportPhoneHref = supportPhone ? `tel:${supportPhone.replace(/[^\d+]/g, '')}` : '#'
export const defaultCustomerAddress = String(import.meta.env.VITE_DEFAULT_CUSTOMER_ADDRESS || '').trim()
export const defaultCustomerCity = String(import.meta.env.VITE_DEFAULT_CUSTOMER_CITY || '').trim()
export const phoneCountryCode = String(import.meta.env.VITE_PHONE_COUNTRY_CODE || '').replace(/\D/g, '')
export const phonePlaceholder = String(import.meta.env.VITE_PHONE_PLACEHOLDER || '').trim()
export const serviceAreaPlaceholder = String(import.meta.env.VITE_SERVICE_AREA_PLACEHOLDER || '').trim()
export const serviceAddresses = parseListEnv('VITE_SERVICE_ADDRESSES')
export const availableServiceAddresses = serviceAddresses.length > 0 ? serviceAddresses : defaultServiceAddresses

export const servicePrices = normalizeServicePrices(parseJsonEnv('VITE_SERVICE_PRICES_JSON', defaultServicePrices))

export function getStartingPrice(serviceType) {
  const prices = Object.values(servicePrices[serviceType]?.primaryOptions || {})
    .map(Number)
    .filter((amount) => amount > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}
