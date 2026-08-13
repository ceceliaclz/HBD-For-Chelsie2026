import type { Place, Visitor } from '../domain/types'

const EARTH_RADIUS_KM = 6371.0088

export function cityPlacesForFilter(
  places: Place[],
  filter: Visitor | 'all',
): Place[] {
  return places.filter(
    (place) =>
      place.placeType === 'city' &&
      (filter === 'all' || place.visitor === filter),
  )
}

export function cityPointsGeoJson(
  places: Place[],
  filter: Visitor | 'all',
) {
  return {
    type: 'FeatureCollection' as const,
    features: cityPlacesForFilter(places, filter).map((place) => ({
      type: 'Feature' as const,
      properties: {
        id: place.id,
        name: place.name,
        visitor: place.visitor,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [place.lng, place.lat] as [number, number],
      },
    })),
  }
}

function offsetLngLat(
  lng: number,
  lat: number,
  eastKm: number,
  northKm: number,
): [number, number] {
  const latRad = (lat * Math.PI) / 180
  const dLat = (northKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const dLng =
    (eastKm / (EARTH_RADIUS_KM * Math.cos(latRad))) * (180 / Math.PI)
  return [lng + dLng, lat + dLat]
}

/**
 * Classic parametric heart curve, projected around a lat/lng center.
 * Scale is roughly the "radius" of the heart in kilometers.
 */
export function heartRing(
  lng: number,
  lat: number,
  scaleKm: number,
  steps = 72,
): [number, number][] {
  const ring: [number, number][] = []
  // Normalize classic heart extents roughly to [-1, 1].
  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * Math.PI * 2
    const x = Math.sin(t) ** 3
    const y =
      (13 * Math.cos(t)
        - 5 * Math.cos(2 * t)
        - 2 * Math.cos(3 * t)
        - Math.cos(4 * t))
      / 16
    // +north follows math +y so lobes face north and the tip points south (pin-like).
    ring.push(offsetLngLat(lng, lat, x * scaleKm, y * scaleKm))
  }
  return ring
}

export function cityAuraGeoJson(
  places: Place[],
  filter: Visitor | 'all',
  scaleKm = 14,
) {
  return {
    type: 'FeatureCollection' as const,
    features: cityPlacesForFilter(places, filter).map((place) => ({
      type: 'Feature' as const,
      properties: {
        id: place.id,
        name: place.name,
        visitor: place.visitor,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [heartRing(place.lng, place.lat, scaleKm)],
      },
    })),
  }
}

/** Rasterize a pink heart for MapLibre symbol layers. */
export function createHeartIconImage(size = 64): {
  width: number
  height: number
  data: Uint8Array
} {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),
    }
  }

  ctx.clearRect(0, 0, size, size)
  // Keep padding so stroke / glow aren't clipped at the canvas edge.
  const pad = size * 0.14
  const cx = size / 2
  const cy = size / 2 + size * 0.02
  const s = (size - pad * 2) * 0.028

  ctx.beginPath()
  for (let index = 0; index <= 80; index += 1) {
    const t = (index / 80) * Math.PI * 2
    const x = cx + s * 16 * Math.sin(t) ** 3
    const y =
      cy
      - s
        * (13 * Math.cos(t)
          - 5 * Math.cos(2 * t)
          - 2 * Math.cos(3 * t)
          - Math.cos(4 * t))
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#F5A0BF'
  ctx.fill()
  ctx.lineWidth = Math.max(2, size * 0.05)
  ctx.strokeStyle = '#fff0f5'
  ctx.lineJoin = 'round'
  ctx.stroke()

  const imageData = ctx.getImageData(0, 0, size, size)
  return {
    width: size,
    height: size,
    data: new Uint8Array(imageData.data.buffer),
  }
}
