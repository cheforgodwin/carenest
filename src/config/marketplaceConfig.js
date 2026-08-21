export const marketplaceCategories = {
  gas: {
    label: 'Gas delivery', kind: 'product', unitLabel: 'cylinder',
    description: 'Gas refills, exchanges, and new cylinders delivered safely.',
    listingPrompt: 'Cylinder sizes or brands (comma separated)',
    orderFields: [
      { name: 'orderType', label: 'Order type', type: 'select', options: ['Refill', 'Exchange', 'New cylinder'] },
      { name: 'variant', label: 'Cylinder size or brand', type: 'listing-options' },
    ],
  },
  water: {
    label: 'Water delivery', kind: 'product', unitLabel: 'container',
    description: 'Drinking water, refillable bottles, and dispensers.',
    listingPrompt: 'Bottle or container sizes (comma separated)',
    orderFields: [
      { name: 'variant', label: 'Container size', type: 'listing-options' },
      { name: 'returnableContainers', label: 'Empty containers to return', type: 'number', min: 0 },
    ],
  },
  essentials: {
    label: 'Home essentials', kind: 'product', unitLabel: 'item',
    description: 'Everyday household supplies delivered to your home.',
    listingPrompt: 'Available sizes or variants (comma separated)',
    orderFields: [{ name: 'variant', label: 'Size or variant', type: 'listing-options' }],
  },
  laundry: {
    label: 'Laundry', kind: 'service', unitLabel: 'load',
    description: 'Washing, ironing, dry cleaning, and pickup services.',
    listingPrompt: 'Packages (comma separated)',
    orderFields: [
      { name: 'variant', label: 'Laundry package', type: 'listing-options' },
      { name: 'fabricNotes', label: 'Clothes and fabric details', type: 'text' },
    ],
  },
  cleaning: {
    label: 'Home cleaning', kind: 'service', unitLabel: 'visit',
    description: 'Scheduled standard and deep-cleaning services.',
    listingPrompt: 'Property types or packages (comma separated)',
    orderFields: [
      { name: 'variant', label: 'Property or package', type: 'listing-options' },
      { name: 'rooms', label: 'Number of rooms', type: 'number', min: 1 },
    ],
  },
  repairs: {
    label: 'Repairs and maintenance', kind: 'service', unitLabel: 'visit',
    description: 'Appliance, plumbing, electrical, and household repairs.',
    listingPrompt: 'Supported appliances or repair types (comma separated)',
    orderFields: [
      { name: 'variant', label: 'Repair type', type: 'listing-options' },
      { name: 'problem', label: 'Describe the problem', type: 'textarea' },
    ],
  },
}

export const marketplaceCategoryEntries = Object.entries(marketplaceCategories)

export function getMarketplaceCategory(category) {
  return marketplaceCategories[category] || marketplaceCategories.essentials
}

export function parseListingOptions(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(source.map((item) => String(item).trim()).filter(Boolean))].slice(0, 12)
}

export function formatMarketplaceAmount(amount) {
  return `${Number(amount || 0).toLocaleString()} FCFA`
}