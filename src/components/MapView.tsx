import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapTouchEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import {
  cityAuraGeoJson,
  cityPointsGeoJson,
  createHeartIconImage,
} from '../geo/cityPoints'
import {
  countryBorderExpression,
  countryFillExpression,
  visitedCountryCodes,
} from '../geo/countryLookup'
import { fitMapToPlaces } from '../geo/fitPlaces'
import countriesGeoJson from '../../public/geo/countries-110m.json'

const COUNTRY_SOURCE_ID = 'countries'
const WORLD_LAND_LAYER_ID = 'world-land'
const WORLD_BORDER_LAYER_ID = 'world-borders'
const COUNTRY_FILL_LAYER_ID = 'visited-countries'
const COUNTRY_LINE_LAYER_ID = 'country-borders'
const CITY_SOURCE_ID = 'city-points'
const CITY_AURA_SOURCE_ID = 'city-auras'
const CITY_AURA_FILL_LAYER_ID = 'city-auras-fill'
const CITY_AURA_LINE_LAYER_ID = 'city-auras-line'
const CITY_HEART_LAYER_ID = 'city-hearts'
const CITY_HEART_IMAGE_ID = 'city-heart-icon'
const LONG_PRESS_MS = 500
const CITY_OUTLINE_MIN_ZOOM = 5

/** Offline-friendly dark atlas: no external tile CDN (works on China mobile data). */
function createLocalAtlasStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'local-dark-atlas',
    sources: {
      [COUNTRY_SOURCE_ID]: {
        type: 'geojson',
        // Inline data so mobile data / CDN fetch of geo/*.json cannot blank the map.
        data: countriesGeoJson as never,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0b1220' },
      },
      {
        id: WORLD_LAND_LAYER_ID,
        type: 'fill',
        source: COUNTRY_SOURCE_ID,
        paint: {
          'fill-color': '#1c2740',
          'fill-opacity': 1,
        },
      },
      {
        id: WORLD_BORDER_LAYER_ID,
        type: 'line',
        source: COUNTRY_SOURCE_ID,
        paint: {
          'line-color': 'rgba(170, 190, 220, 0.28)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            0.5,
            5,
            1.1,
          ],
        },
      },
    ],
  }
}

export interface MapViewProps {
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
  onLongPress: (lngLat: { lng: number; lat: number }) => void
  onMapReady?: (map: MapLibreMap | null) => void
}

function syncOverlayData(
  map: MapLibreMap,
  places: Place[],
  filter: Visitor | 'all',
) {
  const points = map.getSource(CITY_SOURCE_ID) as GeoJSONSource | undefined
  points?.setData(cityPointsGeoJson(places, filter))
  const auras = map.getSource(CITY_AURA_SOURCE_ID) as GeoJSONSource | undefined
  auras?.setData(cityAuraGeoJson(places, filter))
}

function addOverlayLayers(
  map: MapLibreMap,
  places: Place[],
  filter: Visitor | 'all',
  fillExpression: ExpressionSpecification,
  borderExpression: ExpressionSpecification,
) {
  if (map.getLayer(COUNTRY_FILL_LAYER_ID)) {
    syncOverlayData(map, places, filter)
    map.setPaintProperty(COUNTRY_FILL_LAYER_ID, 'fill-color', fillExpression)
    map.setPaintProperty(COUNTRY_LINE_LAYER_ID, 'line-color', borderExpression)
    return
  }

  // Visited wash sits above the local world land layer.
  map.addLayer({
    id: COUNTRY_FILL_LAYER_ID,
    type: 'fill',
    source: COUNTRY_SOURCE_ID,
    paint: {
      'fill-color': fillExpression,
      'fill-opacity': 0.62,
    },
  })
  map.addLayer({
    id: COUNTRY_LINE_LAYER_ID,
    type: 'line',
    source: COUNTRY_SOURCE_ID,
    paint: {
      'line-color': borderExpression,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        1,
        0.8,
        5,
        1.6,
      ],
    },
  })

  map.addSource(CITY_AURA_SOURCE_ID, {
    type: 'geojson',
    data: cityAuraGeoJson(places, filter),
  })
  map.addLayer({
    id: CITY_AURA_FILL_LAYER_ID,
    type: 'fill',
    source: CITY_AURA_SOURCE_ID,
    minzoom: CITY_OUTLINE_MIN_ZOOM,
    paint: {
      'fill-color': '#F5A0BF',
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,
        0.1,
        8,
        0.22,
        11,
        0.16,
      ],
    },
  })
  map.addLayer({
    id: CITY_AURA_LINE_LAYER_ID,
    type: 'line',
    source: CITY_AURA_SOURCE_ID,
    minzoom: CITY_OUTLINE_MIN_ZOOM,
    paint: {
      'line-color': '#F5A0BF',
      'line-opacity': 0.85,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,
        1.2,
        10,
        2.4,
      ],
    },
  })

  map.addSource(CITY_SOURCE_ID, {
    type: 'geojson',
    data: cityPointsGeoJson(places, filter),
  })

  if (map.hasImage(CITY_HEART_IMAGE_ID)) {
    map.removeImage(CITY_HEART_IMAGE_ID)
  }
  map.addImage(CITY_HEART_IMAGE_ID, createHeartIconImage(96), {
    pixelRatio: 2,
  })
  map.addLayer({
    id: CITY_HEART_LAYER_ID,
    type: 'symbol',
    source: CITY_SOURCE_ID,
    layout: {
      'icon-image': CITY_HEART_IMAGE_ID,
      'icon-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        1,
        0.55,
        6,
        0.9,
        10,
        1.15,
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'bottom',
    },
  })
}

export function MapView({
  places,
  filter,
  markerPack,
  onLongPress,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const placeCountRef = useRef(0)
  const placesRef = useRef(places)
  const filterRef = useRef(filter)
  const onMapReadyRef = useRef(onMapReady)
  onMapReadyRef.current = onMapReady
  const visitedCodes = visitedCountryCodes(places, filter)
  const fillExpressionRef = useRef<ExpressionSpecification>(
    countryFillExpression(visitedCodes),
  )
  const borderExpressionRef = useRef<ExpressionSpecification>(
    countryBorderExpression(visitedCodes),
  )
  const onLongPressRef = useRef(onLongPress)

  placesRef.current = places
  filterRef.current = filter
  onLongPressRef.current = onLongPress
  fillExpressionRef.current = countryFillExpression(visitedCodes)
  borderExpressionRef.current = countryBorderExpression(visitedCodes)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: createLocalAtlasStyle(),
      center: [15, 18],
      zoom: 1.25,
      bearing: 0,
      pitch: 0,
      minZoom: 0.8,
      maxZoom: 16,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
      // Needed so memory-card screenshots can read the WebGL canvas.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    mapRef.current = map
    onMapReadyRef.current?.(map)
    // Keep north-up: two-finger rotate made the map feel "upside down".
    map.touchZoomRotate.disableRotation()
    map.dragRotate.disable()

    // Bottom-left, above the dock — clear of camera/settings icons.
    map.addControl(
      new NavigationControl({ showCompass: false }),
      'bottom-left',
    )

    const onStyleReady = () => {
      map.setBearing(0)
      map.setPitch(0)
      addOverlayLayers(
        map,
        placesRef.current,
        filterRef.current,
        fillExpressionRef.current,
        borderExpressionRef.current,
      )
      if (placesRef.current.length > 0) {
        fitMapToPlaces(map, placesRef.current, { animate: false })
      }
    }
    map.on('style.load', onStyleReady)

    map.on('contextmenu', (event: MapMouseEvent) => {
      event.originalEvent.preventDefault()
      onLongPressRef.current({
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      })
    })

    let longPressTimer: ReturnType<typeof setTimeout> | undefined
    const cancelLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer)
      longPressTimer = undefined
    }

    map.on('touchstart', (event: MapTouchEvent) => {
      cancelLongPress()
      const { lng, lat } = event.lngLat
      longPressTimer = setTimeout(() => {
        onLongPressRef.current({ lng, lat })
        longPressTimer = undefined
      }, LONG_PRESS_MS)
    })
    map.on('touchmove', cancelLongPress)
    map.on('touchend', cancelLongPress)

    return () => {
      cancelLongPress()
      onMapReadyRef.current?.(null)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(COUNTRY_FILL_LAYER_ID)) return
    map.setPaintProperty(
      COUNTRY_FILL_LAYER_ID,
      'fill-color',
      fillExpressionRef.current,
    )
    map.setPaintProperty(
      COUNTRY_LINE_LAYER_ID,
      'line-color',
      borderExpressionRef.current,
    )
    syncOverlayData(map, places, filter)
  }, [places, filter])

  useEffect(() => {
    const map = mapRef.current
    if (!map || places.length === 0) return

    const shouldFit =
      placeCountRef.current === 0 || places.length > placeCountRef.current
    placeCountRef.current = places.length
    if (!shouldFit) return

    const runFit = () => fitMapToPlaces(map, places)
    if (map.isStyleLoaded()) {
      runFit()
      return
    }
    map.once('load', runFit)
  }, [places])

  return (
    <div
      ref={containerRef}
      className="map-view"
      data-marker-pack={markerPack}
      aria-label="共同旅行地图"
    />
  )
}
