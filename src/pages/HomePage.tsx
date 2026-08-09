import { MapView } from '../components/MapView'
import type { MarkerPack, Place, Visitor } from '../domain/types'

export interface HomePageProps {
  places?: Place[]
  filter?: Visitor | 'all'
  markerPack?: MarkerPack
}

export function HomePage({
  places = [],
  filter = 'all',
  markerPack = 'stars',
}: HomePageProps) {
  return (
    <main className="home-page">
      <MapView
        places={places}
        filter={filter}
        markerPack={markerPack}
        onLongPress={(lngLat) => {
          console.info('Map long press', lngLat)
        }}
      />
    </main>
  )
}
