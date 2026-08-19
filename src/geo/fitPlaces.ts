import type { Map as LeafletMap } from 'leaflet'
import type { Place } from '../domain/types'

export interface BoundsPadding {
  top: number
  bottom: number
  left: number
  right: number
}

export function placesBoundsPadding(): BoundsPadding {
  const topSafe =
    typeof window !== 'undefined'
      ? Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--safe-top',
          ),
        ) || 0
      : 0

  return {
    // Clear the top meta title / stats and bottom dock CTA.
    top: Math.max(120, 88 + topSafe),
    bottom: 168,
    left: 48,
    right: 48,
  }
}

/** Fit the map so city markers stay clear of notch / bottom card. */
export function fitMapToPlaces(
  map: LeafletMap,
  places: Place[],
  options?: { animate?: boolean },
): void {
  const points = places.filter(
    (place) =>
      Number.isFinite(place.lng) &&
      Number.isFinite(place.lat) &&
      !(place.lng === 0 && place.lat === 0),
  )
  if (points.length === 0) return

  const padding = placesBoundsPadding()
  const animate = options?.animate !== false

  if (points.length === 1) {
    // Zoom in far enough that a city pin reads as a city, not just a lit country.
    map.setView(
      [points[0].lat, points[0].lng],
      Math.max(map.getZoom(), 6.4),
      { animate, duration: animate ? 0.65 : 0 },
    )
    return
  }

  const bounds = points.map(
    (place) => [place.lat, place.lng] as [number, number],
  )
  map.fitBounds(bounds, {
    paddingTopLeft: [padding.left, padding.top],
    paddingBottomRight: [padding.right, padding.bottom],
    maxZoom: 6.2,
    animate,
    duration: animate ? 0.65 : 0,
  })
}
