import { describe, expect, it } from 'vitest'
import { filterMarketplaceListings } from '../src/utils/marketplaceSearch.js'

const listings = [
  {
    title: 'Cooking gas refill',
    description: 'Fast household gas delivery',
    category: 'gas',
    providerName: 'Maison Energie',
    serviceArea: 'Yaounde',
    options: ['12.5 kg'],
  },
  {
    title: 'Laundry pickup',
    description: 'Wash and iron service',
    category: 'laundry',
    providerName: 'Lavage Café',
    serviceArea: 'Douala',
  },
]

describe('filterMarketplaceListings', () => {
  it('matches listing details and categories without case sensitivity', () => {
    expect(filterMarketplaceListings(listings, 'GAS')).toEqual([listings[0]])
    expect(filterMarketplaceListings(listings, 'Douala')).toEqual([listings[1]])
  })

  it('matches accents and returns all listings for a blank query', () => {
    expect(filterMarketplaceListings(listings, 'cafe')).toEqual([listings[1]])
    expect(filterMarketplaceListings(listings, '   ')).toBe(listings)
  })
})
