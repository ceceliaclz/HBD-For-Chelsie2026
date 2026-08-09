import { useState } from 'react'
import { AddPlaceSheet } from '../components/AddPlaceSheet'
import { BottomCard } from '../components/BottomCard'
import { MapView } from '../components/MapView'
import type { MarkerPack, Place, Visitor } from '../domain/types'
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
  const { places, addCity } = useBookStore(initialPlaces)

  return (
    <main className="home-page">
      <MapView
        places={places}
        filter={filter}
        markerPack={markerPack}
        onLongPress={() => setAddPlaceOpen(true)}
      />
      <button
        type="button"
        className="add-place-fab"
        onClick={() => setAddPlaceOpen(true)}
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
        onClose={() => setAddPlaceOpen(false)}
        onSubmit={async (hit, visitor, visitedOn) => {
          await addCity(hit, visitor, visitedOn)
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
