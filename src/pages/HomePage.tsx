import { useState } from 'react'
import { BottomCard } from '../components/BottomCard'
import { MapView } from '../components/MapView'
import type { MarkerPack, Place, Visitor } from '../domain/types'

export interface HomePageProps {
  places?: Place[]
  filter?: Visitor | 'all'
  markerPack?: MarkerPack
}

export function HomePage({
  places = [],
  filter: initialFilter = 'all',
  markerPack = 'stars',
}: HomePageProps) {
  const [filter, setFilter] = useState<Visitor | 'all'>(initialFilter)

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
      <BottomCard
        places={places}
        filter={filter}
        onFilterChange={setFilter}
      />
    </main>
  )
}
