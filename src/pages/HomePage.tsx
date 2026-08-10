import { useState } from 'react'
import {
  AddPlaceSheet,
  type PlaceSelection,
} from '../components/AddPlaceSheet'
import { BottomCard } from '../components/BottomCard'
import { MapView } from '../components/MapView'
import { SettingsSheet } from '../components/SettingsSheet'
import type { CoupleBook, MarkerPack, Member, Place, Visitor } from '../domain/types'
import { approxPlaceFromLngLat } from '../geo/reverseApprox'
import { useBookStore } from '../state/bookStore'

export interface HomePageProps {
  places?: Place[]
  filter?: Visitor | 'all'
  markerPack?: MarkerPack
  book?: CoupleBook
  member?: Member
  onBookChange?: (book: CoupleBook) => void
}

export function HomePage({
  places: initialPlaces,
  filter: initialFilter = 'all',
  markerPack: initialMarkerPack = 'stars',
  book,
  member,
  onBookChange,
}: HomePageProps) {
  const [filter, setFilter] = useState<Visitor | 'all'>(initialFilter)
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [initialPlace, setInitialPlace] = useState<PlaceSelection | null>(null)
  const { places, addPlace, syncStatus } = useBookStore(initialPlaces, {
    syncLifecycle: true,
  })
  const markerPack = book?.markerPack ?? initialMarkerPack
  const syncStatusText = {
    synced: '已同步',
    offline: '离线 · 本地已保存',
    failed: '同步遇到问题 · 足迹仍在本机',
  }[syncStatus]

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
      {book && member && onBookChange && (
        <>
          <button
            type="button"
            className="settings-button"
            aria-label="打开地图设置"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
          <SettingsSheet
            open={settingsOpen}
            book={book}
            member={member}
            onClose={() => setSettingsOpen(false)}
            onBookChange={onBookChange}
          />
        </>
      )}
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
      <div
        className={`sync-status sync-status--${syncStatus}`}
        role="status"
        aria-live="polite"
      >
        {syncStatusText}
      </div>
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
        }}
      />
    </main>
  )
}
