import L from 'leaflet'
import type { Place, PlaceFilter } from '../domain/types'
import { isWish } from '../domain/wishes'

export function datedStops(places: Place[], filter: PlaceFilter): Place[] {
  return places
    .filter((place) => (
      place.placeType === 'city'
      && !isWish(place)
      && Boolean(place.visitedOn)
      && filter !== 'wish'
      && (filter === 'all' || place.visitor === filter)
    ))
    .sort((a, b) => (a.visitedOn ?? '').localeCompare(b.visitedOn ?? ''))
}

export function toward(from: L.LatLng, to: L.LatLng): L.LatLng {
  let lng = to.lng
  while (lng - from.lng > 180) lng -= 360
  while (from.lng - lng > 180) lng += 360
  return L.latLng(to.lat, lng)
}

export function segmentPoints(a: L.LatLng, b: L.LatLng): L.LatLng[] {
  const dest = toward(a, b)
  const dist = a.distanceTo(dest)
  const steps = 48
  if (dist < 300000) {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps
      return L.latLng(a.lat + (dest.lat - a.lat) * t, a.lng + (dest.lng - a.lng) * t)
    })
  }
  const dx = dest.lng - a.lng
  const dy = dest.lat - a.lat
  const len = Math.hypot(dx, dy) || 1
  const lift = Math.min(26, dist / 280000)
  const cLat = (a.lat + dest.lat) / 2 + (-dy / len) * lift
  const cLng = (a.lng + dest.lng) / 2 + (dx / len) * lift
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const u = 1 - t
    return L.latLng(
      u * u * a.lat + 2 * u * t * cLat + t * t * dest.lat,
      u * u * a.lng + 2 * u * t * cLng + t * t * dest.lng,
    )
  })
}

export function drawDottedRoute(layer: L.LayerGroup, stops: Place[]) {
  layer.clearLayers()
  if (stops.length < 2) return
  const points = routePoints(stops)
  L.polyline(points, { color: '#fffaf4', weight: 8, opacity: 0.9, interactive: false }).addTo(layer)
  L.polyline(points, {
    color: '#E07A62',
    weight: 7,
    opacity: 1,
    dashArray: '0 16',
    lineCap: 'round',
    interactive: false,
  }).addTo(layer)
}

function routePoints(stops: Place[]): L.LatLng[] {
  const points: L.LatLng[] = []
  let cursor = L.latLng(stops[0].lat, stops[0].lng)
  points.push(cursor)
  for (let index = 1; index < stops.length; index += 1) {
    const next = toward(cursor, L.latLng(stops[index].lat, stops[index].lng))
    const segment = segmentPoints(cursor, next)
    points.push(...segment.slice(1))
    cursor = next
  }
  return points
}
