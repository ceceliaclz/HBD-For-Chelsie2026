import { useEffect, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  type ExpressionSpecification,
  type MapMouseEvent,
  type MapTouchEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import {
  countryFillExpression,
  dominantVisitorsByCountry,
} from '../geo/countryLookup'
import { CityMarkers } from './CityMarkers'

const COUNTRY_SOURCE_ID = 'countries'
const COUNTRY_FILL_LAYER_ID = 'visited-countries'
const COUNTRY_LINE_LAYER_ID = 'country-borders'
const LONG_PRESS_MS = 500

const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#121826' },
    },
  ],
}

export interface MapViewProps {
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
  onLongPress: (lngLat: { lng: number; lat: number }) => void
}

export function MapView({
  places,
  filter,
  markerPack,
  onLongPress,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null)
  const fillExpressionRef = useRef<ExpressionSpecification>(
    countryFillExpression(dominantVisitorsByCountry(places, filter)),
  )
  const onLongPressRef = useRef(onLongPress)

  onLongPressRef.current = onLongPress
  fillExpressionRef.current = countryFillExpression(
    dominantVisitorsByCountry(places, filter),
  )

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [15, 18],
      zoom: 1.25,
      minZoom: 0.8,
      attributionControl: false,
    })
    mapRef.current = map
    setMapInstance(map)

    map.addControl(
      new NavigationControl({ showCompass: false }),
      'top-right',
    )

    map.on('load', () => {
      map.addSource(COUNTRY_SOURCE_ID, {
        type: 'geojson',
        data: '/geo/countries-110m.json',
      })
      map.addLayer({
        id: COUNTRY_FILL_LAYER_ID,
        type: 'fill',
        source: COUNTRY_SOURCE_ID,
        paint: {
          'fill-color': fillExpressionRef.current,
          'fill-opacity': 0.35,
        },
      })
      map.addLayer({
        id: COUNTRY_LINE_LAYER_ID,
        type: 'line',
        source: COUNTRY_SOURCE_ID,
        paint: {
          'line-color': 'rgba(222, 231, 255, 0.34)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            0.45,
            5,
            1,
          ],
        },
      })
    })

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
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map?.getLayer(COUNTRY_FILL_LAYER_ID)) {
      map.setPaintProperty(
        COUNTRY_FILL_LAYER_ID,
        'fill-color',
        fillExpressionRef.current,
      )
    }
  }, [places, filter])

  return (
    <>
      <div
        ref={containerRef}
        className="map-view"
        data-marker-pack={markerPack}
        aria-label="共同旅行地图"
      />
      {mapInstance && (
        <CityMarkers
          map={mapInstance}
          places={places}
          filter={filter}
          markerPack={markerPack}
        />
      )}
    </>
  )
}
