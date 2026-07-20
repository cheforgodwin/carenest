// Performance optimization utilities for CareNest

/**
 * Debounce function to reduce rapid function calls
 * Useful for form inputs, search, resizing, etc.
 */
export function debounce(func, delay = 300) {
  let timeoutId
  return function debounced(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Throttle function to limit function calls
 * Useful for scroll events, window resize, etc.
 */
export function throttle(func, limit = 300) {
  let lastRun = 0
  return function throttled(...args) {
    const now = Date.now()
    if (now - lastRun >= limit) {
      lastRun = now
      return func(...args)
    }
  }
}

/**
 * Memoize expensive computations
 * Cache results based on arguments
 */
export function memoize(func) {
  const cache = new Map()
  return function memoized(...args) {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = func(...args)
    cache.set(key, result)
    return result
  }
}

/**
 * Group array items by a key for faster lookup
 * Used for grouping orders by status, etc.
 */
export function groupBy(array, keyFunc) {
  return array.reduce((groups, item) => {
    const key = keyFunc(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

/**
 * Paginate array items
 * Used for loading orders in chunks
 */
export function paginate(array, pageNumber = 1, pageSize = 20) {
  const start = (pageNumber - 1) * pageSize
  const end = start + pageSize
  return {
    items: array.slice(start, end),
    total: array.length,
    hasMore: end < array.length,
    pageNumber,
    pageSize,
  }
}

/**
 * Chunk array into smaller arrays
 * Used for batch processing
 */
export function chunk(array, size = 10) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
