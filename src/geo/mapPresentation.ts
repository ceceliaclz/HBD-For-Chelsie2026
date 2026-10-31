import type { MapOptions } from 'leaflet'

export const CITY_OUTLINE_MIN_ZOOM = 4
export const CITY_OUTLINE_SCALE_KM = 32

/**
 * iOS Safari can briefly drop a large SVG map while Leaflet applies its
 * animated zoom transform. Keep gesture controls, but redraw at the final
 * zoom level without the intermediate animation.
 */
export const mapInteractionOptions = {
  zoomControl: false,
  attributionControl: false,
  touchZoom: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false,
  preferCanvas: false,
} satisfies MapOptions
