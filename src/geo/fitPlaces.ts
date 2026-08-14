import { LngLatBounds, type Map as MapLibreMap, type PaddingOptions } from 'maplibre-gl'
import type { Place } from '../domain/types'

export function placesBoundsPadding(): PaddingOptions {
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
  map: MapLibreMap,
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
  if (points.length === 1) {
    // Zoom in far enough that a city pin reads as a city, not just a lit country.
    map.easeTo({
      center: [points[0].lng, points[0].lat],
      // Land inside the zoom band where city outlines become visible.
      zoom: Math.max(map.getZoom(), 6.4),
      bearing: 0,
      pitch: 0,
      padding,
      duration: options?.animate === false ? 0 : 650,
    })
    return
  }

  const bounds = new LngLatBounds()
  for (const place of points) {
    bounds.extend([place.lng, place.lat])
  }
  map.fitBounds(bounds, {
    padding,
    maxZoom: 6.2,
    bearing: 0,
    pitch: 0,
    duration: options?.animate === false ? 0 : 650,
  })
}
