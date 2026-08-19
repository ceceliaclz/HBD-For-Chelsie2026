import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import {
  cityAuraGeoJson,
  cityPlacesForFilter,
} from '../geo/cityPoints'
import {
  countryBorderColor,
  countryWashColor,
  visitedCountryCodes,
} from '../geo/countryLookup'
import { fitMapToPlaces } from '../geo/fitPlaces'
import { formatCityLabel, searchCities } from '../geo/citySearch'
import countriesGeoJson from '../../public/geo/countries-110m.json'

const LONG_PRESS_MS = 500
const CITY_OUTLINE_MIN_ZOOM = 5
const HEART_PINK = '#F5A0BF'
const SVG_NS = 'http://www.w3.org/2000/svg'
const OCEAN = '#0a1020'
const LAND = '#3d4f6f'
const BORDER = 'rgba(210, 225, 255, 0.55)'

export interface MapViewProps {
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
  onLongPress: (lngLat: { lng: number; lat: number }) => void
  onMapReady?: (map: L.Map | null) => void
}

function atlasCountriesData(): GeoJSON.FeatureCollection {
  const raw = countriesGeoJson as unknown as {
    type: string
    features: GeoJSON.Feature[]
  }
  return {
    type: 'FeatureCollection',
    features: raw.features,
  }
}

function featureCountryCode(
  properties: GeoJSON.GeoJsonProperties | null | undefined,
): string {
  if (!properties) return ''
  const primary = String(properties.ISO_A2 ?? properties.iso_a2 ?? '')
    .trim()
    .toUpperCase()
  if (primary === '-99') {
    return String(properties.ISO_A2_EH ?? '')
      .trim()
      .toUpperCase()
  }
  return primary
}

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

function createHeartMarkerElement(place: Place): HTMLDivElement {
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

  return element
}

function styleCountry(
  feature: GeoJSON.Feature | undefined,
  visited: Set<string>,
): L.PathOptions {
  const code = featureCountryCode(feature?.properties)
  if (code && visited.has(code)) {
    return {
      fillColor: countryWashColor(code),
      fillOpacity: 0.62,
      color: countryBorderColor(code),
      weight: 1.2,
      opacity: 0.95,
    }
  }
  return {
    fillColor: LAND,
    fillOpacity: 1,
    color: BORDER,
    weight: 0.8,
    opacity: 1,
  }
}

export function MapView({
  places,
  filter,
  markerPack,
  onLongPress,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const countriesLayerRef = useRef<L.GeoJSON | null>(null)
  const aurasLayerRef = useRef<L.GeoJSON | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const placeCountRef = useRef(0)
  const placesRef = useRef(places)
  const filterRef = useRef(filter)
  const onMapReadyRef = useRef(onMapReady)
  const onLongPressRef = useRef(onLongPress)

  onMapReadyRef.current = onMapReady
  placesRef.current = places
  filterRef.current = filter
  onLongPressRef.current = onLongPress

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [18, 15],
      zoom: 2,
      minZoom: 1,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
    })
    mapRef.current = map
    onMapReadyRef.current?.(map)

    const visited = visitedCountryCodes(placesRef.current, filterRef.current)
    const countries = L.geoJSON(atlasCountriesData(), {
      style: (feature) => styleCountry(feature, visited),
      interactive: false,
    }).addTo(map)
    countriesLayerRef.current = countries

    const auras = L.geoJSON(cityAuraGeoJson(placesRef.current, filterRef.current), {
      style: {
        fillColor: HEART_PINK,
        fillOpacity: 0.18,
        color: HEART_PINK,
        weight: 1.6,
        opacity: 0.85,
      },
      interactive: false,
    })
    aurasLayerRef.current = auras
    if (map.getZoom() >= CITY_OUTLINE_MIN_ZOOM) {
      auras.addTo(map)
    }

    const markers = L.layerGroup().addTo(map)
    markersLayerRef.current = markers
    for (const place of cityPlacesForFilter(
      placesRef.current,
      filterRef.current,
    )) {
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: 'city-marker-wrap',
          html: createHeartMarkerElement(place).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 48],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(markers)
    }

    if (placesRef.current.length > 0) {
      fitMapToPlaces(map, placesRef.current, { animate: false })
    }

    map.on('zoomend', () => {
      const layer = aurasLayerRef.current
      if (!layer) return
      if (map.getZoom() >= CITY_OUTLINE_MIN_ZOOM) {
        if (!map.hasLayer(layer)) layer.addTo(map)
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })

    let longPressTimer: ReturnType<typeof setTimeout> | undefined
    const cancelLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer)
      longPressTimer = undefined
    }

    map.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(event.originalEvent)
      onLongPressRef.current({
        lng: event.latlng.lng,
        lat: event.latlng.lat,
      })
    })

    const container = map.getContainer()
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelLongPress()
        return
      }
      const touch = event.touches[0]
      const rect = container.getBoundingClientRect()
      const point = L.point(
        touch.clientX - rect.left,
        touch.clientY - rect.top,
      )
      const latlng = map.containerPointToLatLng(point)
      cancelLongPress()
      longPressTimer = setTimeout(() => {
        onLongPressRef.current({ lng: latlng.lng, lat: latlng.lat })
        longPressTimer = undefined
      }, LONG_PRESS_MS)
    }
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', cancelLongPress, { passive: true })
    container.addEventListener('touchend', cancelLongPress, { passive: true })
    map.on('dragstart', cancelLongPress)

    const onWindowResize = () => {
      map.invalidateSize()
    }
    window.addEventListener('resize', onWindowResize)
    window.setTimeout(() => map.invalidateSize(), 50)
    window.setTimeout(() => map.invalidateSize(), 300)

    return () => {
      window.removeEventListener('resize', onWindowResize)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', cancelLongPress)
      container.removeEventListener('touchend', cancelLongPress)
      cancelLongPress()
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
      countriesLayerRef.current = null
      aurasLayerRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const countries = countriesLayerRef.current
    const auras = aurasLayerRef.current
    const markers = markersLayerRef.current
    if (!map || !countries || !auras || !markers) return

    const visited = visitedCountryCodes(places, filter)
    countries.setStyle((feature) => styleCountry(feature, visited))

    auras.clearLayers()
    auras.addData(cityAuraGeoJson(places, filter) as GeoJSON.GeoJsonObject)

    markers.clearLayers()
    for (const place of cityPlacesForFilter(places, filter)) {
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: 'city-marker-wrap',
          html: createHeartMarkerElement(place).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 48],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(markers)
    }
  }, [places, filter])

  useEffect(() => {
    const map = mapRef.current
    if (!map || places.length === 0) return

    const shouldFit =
      placeCountRef.current === 0 || places.length > placeCountRef.current
    placeCountRef.current = places.length
    if (!shouldFit) return

    fitMapToPlaces(map, places)
  }, [places])

  return (
    <>
      <div
        ref={containerRef}
        className="map-view"
        data-marker-pack={markerPack}
        aria-label="共同旅行地图"
        style={{ background: OCEAN }}
      />
      <div className="map-zoom" role="group" aria-label="地图缩放">
        <button
          type="button"
          className="map-zoom__btn"
          aria-label="放大"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          className="map-zoom__btn"
          aria-label="缩小"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
      </div>
    </>
  )
}
