import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMapsLibrary } from '../firebase/googleMapsLoader'
import './GoogleMapCanvas.css'

const defaultCenter = { lat: 3.848, lng: 11.502 }

function isPoint(point) {
  return Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point?.lng) && point.lng >= -180 && point.lng <= 180
}

function samePoint(first, second) {
  return first.lat === second.lat && first.lng === second.lng
}

export default function GoogleMapCanvas({
  ariaLabel,
  markers,
  route,
  selectedOrderId,
  onMarkerSelect,
  emptyMessage = 'No verified locations yet',
}) {
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const directionsRendererRef = useRef(null)
  const routeSequenceRef = useRef(0)
  const markerSelectRef = useRef(onMarkerSelect)
  const currentMarkersRef = useRef(markers)
  const currentRouteRef = useRef(route)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [routeSummary, setRouteSummary] = useState(null)

  markerSelectRef.current = onMarkerSelect
  currentMarkersRef.current = markers
  currentRouteRef.current = route

  const markerSignature = useMemo(() => markers
    .map(({ orderId, kind, title, label, position, selected }) =>
      [orderId, kind, title, label, position?.lat, position?.lng, selected].join(':'))
    .join('|'), [markers])
  const routeSignature = route && isPoint(route.origin) && isPoint(route.destination)
    ? JSON.stringify([route.origin.lat, route.origin.lng, route.destination.lat, route.destination.lng, route.travelMode])
    : ''

  useEffect(() => {
    let disposed = false
    loadGoogleMapsLibrary('maps').then((library) => {
      if (!library) throw new Error('Google Maps API key is not configured.')
      if (disposed || !mapElementRef.current) return
      const maps = window.google.maps
      mapRef.current = new maps.Map(mapElementRef.current, {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      })
      setMapReady(true)
    }).catch(() => {
      if (!disposed) setMapError('Google Maps could not be loaded. Check your connection and Maps API configuration.')
    })

    return () => {
      disposed = true
      routeSequenceRef.current += 1
      markersRef.current.forEach((marker) => marker.setMap(null))
      directionsRendererRef.current?.setMap(null)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const maps = window.google.maps
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = currentMarkersRef.current.filter(({ position }) => isPoint(position)).map((item) => {
      const marker = new maps.Marker({
        map: mapRef.current,
        position: item.position,
        title: item.title,
        label: { text: item.label, color: '#fff', fontWeight: '700' },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: item.selected ? 13 : 11,
          fillColor: item.kind === 'rider' ? '#087a48' : item.kind === 'pickup' ? '#4a68bd' : '#f27b29',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
      })
      marker.addListener('click', () => markerSelectRef.current?.(item.orderId))
      return marker
    })

    const points = currentMarkersRef.current.filter(({ position }) => isPoint(position)).map(({ position }) => position)
    if (!points.length) {
      mapRef.current.setCenter(defaultCenter)
      mapRef.current.setZoom(12)
      return
    }
    if (points.every((point) => samePoint(point, points[0]))) {
      mapRef.current.setCenter(points[0])
      mapRef.current.setZoom(14)
      return
    }
    const bounds = new maps.LatLngBounds()
    points.forEach((point) => bounds.extend(point))
    mapRef.current.fitBounds(bounds, 48)
  }, [mapReady, markerSignature])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const selected = currentMarkersRef.current.filter(({ orderId, position }) =>
      orderId === selectedOrderId && isPoint(position))
    if (!selected.length) return
    const maps = window.google.maps
    if (selected.length === 1 || selected.every(({ position }) => samePoint(position, selected[0].position))) {
      mapRef.current.panTo(selected[0].position)
      mapRef.current.setZoom(14)
      return
    }
    const bounds = new maps.LatLngBounds()
    selected.forEach(({ position }) => bounds.extend(position))
    mapRef.current.fitBounds(bounds, 48)
  }, [mapReady, markerSignature, selectedOrderId])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const sequence = ++routeSequenceRef.current
    if (!routeSignature) {
      directionsRendererRef.current?.setMap(null)
      directionsRendererRef.current = null
      setRouteSummary(null)
      return () => {}
    }

    setRouteSummary({ loading: true })
    loadGoogleMapsLibrary('routes').then(async (library) => {
      if (!library) throw new Error('Google Maps routes are unavailable.')
      const maps = window.google.maps
      const renderer = new maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#087a48', strokeOpacity: 0.9, strokeWeight: 5 },
      })
      if (sequence !== routeSequenceRef.current) {
        renderer.setMap(null)
        return
      }
      directionsRendererRef.current?.setMap(null)
      directionsRendererRef.current = renderer
      const currentRoute = currentRouteRef.current
      const service = new maps.DirectionsService()
      const result = await service.route({
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        travelMode: maps.TravelMode[String(currentRoute.travelMode || 'driving').toUpperCase()],
      })
      if (sequence !== routeSequenceRef.current) return
      renderer.setDirections(result)
      const leg = result.routes?.[0]?.legs?.[0]
      setRouteSummary(leg?.distance?.text && leg?.duration?.text
        ? { distance: leg.distance.text, duration: leg.duration.text }
        : { error: true })
    }).catch(() => {
      if (sequence === routeSequenceRef.current) setRouteSummary({ error: true })
    })

    return () => {
      if (sequence === routeSequenceRef.current) routeSequenceRef.current += 1
    }
  }, [mapReady, routeSignature])

  return (
    <div className="google-map-canvas" role="application" aria-label={ariaLabel}>
      <div className="google-map-surface" ref={mapElementRef} aria-hidden="true" />
      {!markers.length && <div className="google-map-empty" role="status">{emptyMessage}</div>}
      {mapError && <div className="google-map-message" role="alert">{mapError}</div>}
      {routeSummary && <div className="google-map-route-summary" role="status" aria-live="polite">
        {routeSummary.loading ? 'Calculating route…' : routeSummary.error
          ? 'Route estimate unavailable for these locations.'
          : `${routeSummary.distance} · ${routeSummary.duration}`}
      </div>}
      <ul className="google-map-accessible-list" aria-label="Map locations">
        {markers.map((marker) => <li key={`${marker.orderId}-${marker.kind}`}>
          <button type="button" onClick={() => markerSelectRef.current?.(marker.orderId)}>{marker.title}</button>
        </li>)}
      </ul>
    </div>
  )
}
