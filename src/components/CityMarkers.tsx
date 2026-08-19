import type { MarkerPack, Place, Visitor } from '../domain/types'
import { cityPlacesForFilter } from '../geo/cityPoints'

export { cityPlacesForFilter }

export interface CityMarkersProps {
  places: Place[]
  filter: Visitor | 'all'
  markerPack: MarkerPack
}

/** Hearts are rendered inside MapView (Leaflet). Kept for shared helpers/tests. */
export function CityMarkers(_props: CityMarkersProps) {
  return null
}
