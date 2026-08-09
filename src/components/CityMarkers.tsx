import { useEffect } from 'react'
import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { markerGlyph } from '../domain/markerPacks'
import type { MarkerPack, Place, Visitor } from '../domain/types'

const ROLE_COLORS: Record<Visitor, string> = {
  rabbit: '#F5A0BF',
  dog: '#8CC8FF',
  together: '#FFD278',
}

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

export interface CityMarkersProps {
  map: MapLibreMap
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
}

export function CityMarkers({
  map,
  places,
  filter,
  markerPack,
}: CityMarkersProps) {
  useEffect(() => {
    const markers = cityPlacesForFilter(places, filter).map((place) => {
      const element = document.createElement('div')
      element.className = `city-marker city-marker--${place.visitor}`
      element.style.setProperty('--marker-color', ROLE_COLORS[place.visitor])
      element.setAttribute('aria-label', `${place.name}，${place.visitor}`)
      element.title = place.name

      const glyph = document.createElement('span')
      glyph.className = 'city-marker__glyph'
      glyph.textContent = markerGlyph(markerPack, place.visitor)
      element.append(glyph)

      const label = document.createElement('span')
      label.className = 'city-marker__label'
      label.textContent = place.name
      element.append(label)

      return new Marker({ element, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [filter, map, markerPack, places])

  return null
}
