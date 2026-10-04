import { getMarketplaceCategory } from '../config/marketplaceConfig'

function normalizeSearchText(value, locale) {
  return String(value || '')
    .toLocaleLowerCase(locale)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function filterMarketplaceListings(listings, searchQuery, locale = 'en') {
  const query = normalizeSearchText(searchQuery.trim(), locale)
  if (!query) return listings

  return listings.filter((listing) => {
    const category = getMarketplaceCategory(listing.category)
    const searchableText = [
      listing.title,
      listing.description,
      listing.providerName,
      listing.serviceArea,
      listing.turnaround,
      category.label,
      category.unitLabel,
      ...(Array.isArray(listing.options) ? listing.options : []),
    ].filter(Boolean).join(' ')

    return normalizeSearchText(searchableText, locale).includes(query)
  })
}
