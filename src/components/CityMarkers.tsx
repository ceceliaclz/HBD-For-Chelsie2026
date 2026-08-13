import { useEffect } from 'react'
import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import { cityPlacesForFilter } from '../geo/cityPoints'
import { formatCityLabel, searchCities } from '../geo/citySearch'

export { cityPlacesForFilter }

const HEART_PINK = '#F5A0BF'
const SVG_NS = 'http://www.w3.org/2000/svg'

function markerLabel(place: Place): string {
  const hit = searchCities(place.name, 12).find(
    (candidate) =>
      candidate.countryCode === place.countryCode &&
      (candidate.name === place.name ||
        candidate.nameZh === place.name ||
        candidate.aliases?.includes(place.name)),
  )
  if (!hit) return place.name
  return hit.nameZh ?? hit.name
}

function createHeartSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'city-marker__heart-svg')
  // Padded viewBox so the white stroke isn't clipped.
  svg.setAttribute('viewBox', '-3 -3 38 36')
  svg.setAttribute('width', '40')
  svg.setAttribute('height', '38')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute(
    'd',
    'M16 27.2C16 27.2 3.5 19.1 3.5 11.2 3.5 6.9 6.9 3.8 11 3.8c2.3 0 3.9 1.1 5 2.6 1.1-1.5 2.7-2.6 5-2.6 4.1 0 7.5 3.1 7.5 7.4 0 7.9-12.5 16-12.5 16z',
  )
  path.setAttribute('fill', HEART_PINK)
  path.setAttribute('stroke', '#fff0f5')
  path.setAttribute('stroke-width', '2.2')
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('paint-order', 'stroke fill')
  svg.append(path)
  return svg
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
}: CityMarkersProps) {
  useEffect(() => {
    const markers = cityPlacesForFilter(places, filter).map((place) => {
      const labelText = markerLabel(place)
      const element = document.createElement('div')
      element.className = 'city-marker city-marker--heart'
      element.style.setProperty('--marker-color', HEART_PINK)
      element.setAttribute('aria-label', `${labelText}，心形标记`)
      element.title = formatCityLabel({
        name: place.name,
        nameZh: labelText !== place.name ? labelText : undefined,
      })

      const heartWrap = document.createElement('span')
      heartWrap.className = 'city-marker__heart'
      heartWrap.setAttribute('aria-hidden', 'true')
      heartWrap.append(createHeartSvg())
      element.append(heartWrap)

      const glyph = document.createElement('span')
      glyph.className = 'city-marker__glyph'
      glyph.hidden = true
      glyph.textContent = '💗'
      element.append(glyph)

      const label = document.createElement('span')
      label.className = 'city-marker__label'
      label.textContent = labelText
      element.append(label)

      return new Marker({ element, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [filter, map, places])

  return null
}
