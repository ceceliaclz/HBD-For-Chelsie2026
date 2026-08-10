import { useState } from 'react'
import {
  AddPlaceSheet,
  type PlaceSelection,
} from '../components/AddPlaceSheet'
import { BottomCard } from '../components/BottomCard'
import { MapView } from '../components/MapView'
import type { MarkerPack, Place, Visitor } from '../domain/types'
import { approxPlaceFromLngLat } from '../geo/reverseApprox'
import { useBookStore } from '../state/bookStore'
import { syncNow } from '../sync/syncEngine'

export interface HomePageProps {
  places?: Place[]
  filter?: Visitor | 'all'
  markerPack?: MarkerPack
}

export function HomePage({
  places: initialPlaces,
  filter: initialFilter = 'all',
  markerPack = 'stars',
}: HomePageProps) {
  const [filter, setFilter] = useState<Visitor | 'all'>(initialFilter)
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [initialPlace, setInitialPlace] = useState<PlaceSelection | null>(null)
  const { places, addPlace } = useBookStore(initialPlaces)

  return (
    <main className="home-page">
      <MapView
        places={places}
        filter={filter}
        markerPack={markerPack}
        onLongPress={(lngLat) => {
          const approximate = approxPlaceFromLngLat(lngLat)
          setInitialPlace(approximate.nearestCity
            ? { ...approximate.nearestCity, placeType: 'city' }
            : {
                placeType: 'country',
                name: approximate.countryName,
                countryCode: approximate.countryCode,
                countryName: approximate.countryName,
                ...lngLat,
              })
          setAddPlaceOpen(true)
        }}
      />
      <button
        type="button"
        className="add-place-fab"
        onClick={() => {
          setInitialPlace(null)
          setAddPlaceOpen(true)
        }}
      >
        <span aria-hidden="true">＋</span>
        点亮新地方
      </button>
      <BottomCard
        places={places}
        filter={filter}
        onFilterChange={setFilter}
      />
      <AddPlaceSheet
        open={addPlaceOpen}
        defaultVisitor="together"
        initialPlace={initialPlace}
        onClose={() => setAddPlaceOpen(false)}
        onSubmit={async (hit, visitor, visitedOn) => {
          await addPlace(hit, visitor, visitedOn)
          try {
            await syncNow()
          } catch {
            // The local visit is already durable; remote sync can retry later.
          }
        }}
      />
    </main>
  )
}
