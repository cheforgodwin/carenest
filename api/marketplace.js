import { marketplaceCategories } from '../src/config/marketplaceConfig.js'
import { getAdminDb } from './_firebaseAdmin.js'
import { handleCors } from './_cors.js'

function publicListing(document) {
  const data = document.data()
  const category = marketplaceCategories[data.category]
  const price = Number(data.price)

  if (!category || !Number.isSafeInteger(price) || price < 100 || typeof data.title !== 'string' || !data.title.trim()) {
    return null
  }

  return {
    firestoreId: document.id,
    title: data.title.slice(0, 120),
    description: typeof data.description === 'string' ? data.description.slice(0, 2000) : '',
    category: data.category,
    providerName: typeof data.providerName === 'string' ? data.providerName.slice(0, 80) : 'CareNest provider',
    serviceArea: typeof data.serviceArea === 'string' ? data.serviceArea.slice(0, 240) : '',
    turnaround: typeof data.turnaround === 'string' ? data.turnaround.slice(0, 120) : '',
    price,
    unit: typeof data.unit === 'string' ? data.unit.slice(0, 40) : category.unitLabel,
    options: Array.isArray(data.options)
      ? data.options.filter((option) => typeof option === 'string').slice(0, 12).map((option) => option.slice(0, 120))
      : [],
    stockTracked: data.stockTracked === true,
    stockQuantity: Number.isSafeInteger(data.stockQuantity) && data.stockQuantity >= 0 ? data.stockQuantity : 0,
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res, ['GET'])) return

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  const send = (status, body) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }

  if (req.method !== 'GET') return send(405, { error: 'Use GET.' })

  try {
    const snapshot = await getAdminDb().collection('providerListings').where('active', '==', true).get()
    const listings = snapshot.docs
      .map(publicListing)
      .filter(Boolean)
      .sort((first, second) => first.title.localeCompare(second.title))
    return send(200, { listings })
  } catch {
    console.warn('public_marketplace_unavailable')
    return send(503, { error: 'Storefront listings are temporarily unavailable.' })
  }
}
