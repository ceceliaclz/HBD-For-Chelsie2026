import { useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  AddPlaceSheet,
  type PlaceSelection,
} from '../components/AddPlaceSheet'
import { BottomCard, HomeTopStats } from '../components/BottomCard'
import { IconCamera, IconSettings } from '../components/icons'
import { MapView } from '../components/MapView'
import { SettingsSheet } from '../components/SettingsSheet'
import type { CoupleBook, MarkerPack, Member, Place, Visitor } from '../domain/types'
import { approxPlaceFromLngLat } from '../geo/reverseApprox'
import {
  captureMemoryCard,
  formatCardDate,
  saveMemoryCard,
} from '../lib/captureMemoryCard'
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
  const [capturing, setCapturing] = useState(false)
  const [captureMessage, setCaptureMessage] = useState('')
  const mapRef = useRef<MapLibreMap | null>(null)
  const { places, addPlace, syncStatus } = useBookStore(initialPlaces, {
    syncLifecycle: true,
  })
  const markerPack = book?.markerPack ?? initialMarkerPack
  const syncStatusText = {
    synced: '已同步',
    offline: '离线 · 本地已保存',
    failed: '同步遇到问题 · 足迹仍在本机',
  }[syncStatus]

  async function handleCapture() {
    const map = mapRef.current
    if (!map || capturing) return
    setCapturing(true)
    setCaptureMessage('正在生成纪念卡…')
    try {
      const blob = await captureMemoryCard({ map, places })
      const filename = `我们的地图-${formatCardDate().replaceAll('.', '')}.png`
      await saveMemoryCard(blob, filename)
      setCaptureMessage('已保存纪念卡')
    } catch (error) {
      const message = error instanceof Error ? error.message : '截图失败'
      setCaptureMessage(message)
    } finally {
      setCapturing(false)
      window.setTimeout(() => setCaptureMessage(''), 2200)
    }
  }

  function openAddPlace(place: PlaceSelection | null = null) {
    setInitialPlace(place)
    setAddPlaceOpen(true)
  }

  return (
    <main className="home-page">
      <MapView
        places={places}
        filter={filter}
        markerPack={markerPack}
        onMapReady={(map) => {
          mapRef.current = map
        }}
        onLongPress={(lngLat) => {
          const approximate = approxPlaceFromLngLat(lngLat)
          openAddPlace(
            approximate.nearestCity
              ? { ...approximate.nearestCity, placeType: 'city' }
              : {
                  placeType: 'country',
                  name: approximate.countryName,
                  countryCode: approximate.countryCode,
                  countryName: approximate.countryName,
                  ...lngLat,
                },
          )
        }}
      />

      <HomeTopStats places={places} />

      <div className="home-top-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="保存地图截图"
          disabled={capturing}
          onClick={() => void handleCapture()}
        >
          {capturing ? '…' : <IconCamera />}
        </button>
        {book && member && onBookChange && (
          <button
            type="button"
            className="icon-button"
            aria-label="打开地图设置"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings />
          </button>
        )}
      </div>

      {book && member && onBookChange && (
        <SettingsSheet
          open={settingsOpen}
          book={book}
          member={member}
          onClose={() => setSettingsOpen(false)}
          onBookChange={onBookChange}
        />
      )}

      {captureMessage && (
        <div className="capture-toast" role="status" aria-live="polite">
          {captureMessage}
        </div>
      )}

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
        onAddPlace={() => openAddPlace(null)}
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
