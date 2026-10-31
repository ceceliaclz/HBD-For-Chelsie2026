import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import {
  cityAuraGeoJson,
  placesForPins,
} from '../geo/cityPoints'
import {
  countryBorderColor,
  countryWashColor,
  visitedCountryCodes,
} from '../geo/countryLookup'
import { fitMapToPlaces } from '../geo/fitPlaces'
import {
  CITY_OUTLINE_MIN_ZOOM,
  CITY_OUTLINE_SCALE_KM,
  mapInteractionOptions,
} from '../geo/mapPresentation'
import { searchCities } from '../geo/citySearch'
import countriesGeoJson from '../../public/geo/countries-110m.json'

const LONG_PRESS_MS = 500
const HEART_PINK = '#FF8A5B'
const OCEAN = '#efe4d6'
const LAND = '#f7f1e8'
const BORDER = '#e4cfc0'
const VISITOR_PIN: Record<Visitor, string> = {
  together: '#FF8A5B',
  rabbit: '#FF6D8F',
  dog: '#5EB8C8',
}

export interface MapViewProps {
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
  onLongPress: (lngLat: { lng: number; lat: number }) => void
  onPlaceOpen?: (place: Place) => void
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
  if (place.placeType === 'country') return place.name === 'United States' ? '美国' : place.name
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ))
}

export function placeMarkerHtml(place: Place): { html: string; iconSize: [number, number]; iconAnchor: [number, number] } {
  const label = escapeHtml(markerLabel(place))
  const when = place.visitedOn ? `<span class="pin__date">${escapeHtml(place.visitedOn)}</span>` : ''
  const color = VISITOR_PIN[place.visitor]
  const photos = place.photos ?? []
  if (!photos.length) {
    return {
      html: `<div class="pin pin--empty" style="--pin:${color}"><span class="pin__mark">待添加</span><span class="pin__name">${label}${when}</span></div>`,
      iconSize: [96, when ? 76 : 58],
      iconAnchor: [48, when ? 38 : 28],
    }
  }
  const shot = escapeHtml(photos[0])
  return {
    html: `<div class="pin pin--photo" style="--pin:${color}"><span class="pin__tape"></span><span class="pin__shot" style="background-image:url('${shot}')"></span><span class="pin__count">${photos.length}</span><span class="pin__name">${label}${when}</span></div>`,
    iconSize: [96, when ? 126 : 108],
    iconAnchor: [40, when ? 104 : 86],
  }
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
  onPlaceOpen,
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
  const onPlaceOpenRef = useRef(onPlaceOpen)

  onMapReadyRef.current = onMapReady
  placesRef.current = places
  filterRef.current = filter
  onLongPressRef.current = onLongPress
  onPlaceOpenRef.current = onPlaceOpen

  function addPlaceMarker(markers: L.LayerGroup, place: Place) {
    const icon = placeMarkerHtml(place)
    const marker = L.marker([place.lat, place.lng], {
      icon: L.divIcon({
        className: 'city-marker-wrap',
        html: icon.html,
        iconSize: icon.iconSize,
        iconAnchor: icon.iconAnchor,
      }),
      interactive: true,
      keyboard: true,
    })
    marker.on('click', () => onPlaceOpenRef.current?.(place))
    marker.addTo(markers)
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [18, 15],
      zoom: 2,
      minZoom: 1,
      maxZoom: 16,
      ...mapInteractionOptions,
    })
    mapRef.current = map
    onMapReadyRef.current?.(map)

    const visited = visitedCountryCodes(placesRef.current, filterRef.current)
    const countries = L.geoJSON(atlasCountriesData(), {
      style: (feature) => styleCountry(feature, visited),
      interactive: false,
    }).addTo(map)
    countriesLayerRef.current = countries

    const auras = L.geoJSON(
      cityAuraGeoJson(
        placesRef.current,
        filterRef.current,
        CITY_OUTLINE_SCALE_KM,
      ),
      {
        style: {
          fillColor: HEART_PINK,
          fillOpacity: 0.12,
          color: '#ffd7e6',
          weight: 2,
          opacity: 0.95,
          dashArray: '5 4',
        },
        interactive: false,
      },
    )
    aurasLayerRef.current = auras
    if (map.getZoom() >= CITY_OUTLINE_MIN_ZOOM) {
      auras.addTo(map)
    }

    const markers = L.layerGroup().addTo(map)
    markersLayerRef.current = markers
    for (const place of placesForPins(
      placesRef.current,
      filterRef.current,
    )) {
      addPlaceMarker(markers, place)
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
    auras.addData(
      cityAuraGeoJson(
        places,
        filter,
        CITY_OUTLINE_SCALE_KM,
      ) as GeoJSON.GeoJsonObject,
    )

    markers.clearLayers()
    for (const place of placesForPins(places, filter)) {
      addPlaceMarker(markers, place)
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
    <div
      ref={containerRef}
      className="map-view"
      data-marker-pack={markerPack}
      aria-label="共同旅行地图，可双指缩放"
      style={{ background: OCEAN }}
    />
  )
}
