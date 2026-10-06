function pointQuery(point) {
  const lat = Number(point?.lat)
  const lng = Number(point?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : ''
}

export function googleMapsPointUrl(point) {
  const query = pointQuery(point)
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

export function googleMapsDirectionsUrl(destination, mode = 'driving', origin) {
  const target = pointQuery(destination)
  if (!target) return ''
  const start = pointQuery(origin)
  const params = new URLSearchParams({ api: '1', destination: target, travelmode: ['walking', 'bicycling'].includes(mode) ? mode : 'driving' })
  if (start) params.set('origin', start)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
