import { useEffect, useRef, useState } from 'react'
import L, { type Map as LeafletMap } from 'leaflet'
import {
  AddPlaceSheet,
  type PlaceSelection,
} from '../components/AddPlaceSheet'
import { BottomCard, HomeTopStats } from '../components/BottomCard'
import { IconCamera, IconSettings } from '../components/icons'
import { MapView } from '../components/MapView'
import { PlacePhotoSheet } from '../components/PlacePhotoSheet'
import { SettingsSheet } from '../components/SettingsSheet'
import type { CoupleBook, MarkerPack, Member, Place, Visitor } from '../domain/types'
import { approxPlaceFromLngLat } from '../geo/reverseApprox'
import {
  captureMemoryCard,
  formatCardDate,
  saveMemoryCard,
} from '../lib/captureMemoryCard'
import { datedStops, drawDottedRoute, segmentPoints, toward } from '../lib/footprint'
import { filesToPhotoUrls } from '../lib/photos'
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
  const [footprintOn, setFootprintOn] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [perStop, setPerStop] = useState(5)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [memory, setMemory] = useState<{ name: string; text: string; photo?: string } | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const routeRef = useRef<L.LayerGroup | null>(null)
  const playToken = useRef(0)
  const { places, addPlace, attachPhotos, updateVisitedOn, syncStatus } = useBookStore(initialPlaces, {
    syncLifecycle: true,
  })
  const selected = places.find((place) => place.id === selectedId) ?? null
  const markerPack = book?.markerPack ?? initialMarkerPack
  const syncStatusText = {
    synced: '已同步',
    offline: '离线 · 本地已保存',
    failed: '这次没写上云端',
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

  function ensureRoute() {
    const map = mapRef.current
    if (!map) return null
    if (!routeRef.current) routeRef.current = L.layerGroup().addTo(map)
    return routeRef.current
  }

  useEffect(() => {
    if (playing) return
    const layer = ensureRoute()
    if (!layer) return
    drawDottedRoute(layer, footprintOn ? datedStops(places, filter) : [])
  }, [places, filter, footprintOn, playing, mapReady])

  function wait(ms: number) {
    return new Promise((resolve) => { window.setTimeout(resolve, ms) })
  }

  async function animateSegment(from: L.LatLng, to: L.LatLng, token: number) {
    const map = mapRef.current
    const layer = routeRef.current
    if (!map || !layer) return
    const points = segmentPoints(from, to)
    const dist = from.distanceTo(toward(from, to))
    map.flyToBounds(L.latLngBounds(points), {
      paddingTopLeft: [36, 64],
      paddingBottomRight: [36, 180],
      maxZoom: dist < 300000 ? 8 : 4,
      duration: 0.8,
    })
    await wait(740)
    if (token !== playToken.current) return
    const casing = L.polyline([points[0]], { color: '#fffaf4', weight: 8, opacity: 0.9, interactive: false }).addTo(layer)
    const line = L.polyline([points[0]], {
      color: '#E07A62', weight: 7, opacity: 1, dashArray: '0 16', lineCap: 'round', interactive: false,
    }).addTo(layer)
    const started = performance.now()
    const duration = dist < 300000 ? 1400 : 2800
    await new Promise<void>((resolve) => {
      function frame(now: number) {
        if (token !== playToken.current) { resolve(); return }
        let t = Math.min(1, (now - started) / duration)
        t = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
        const count = Math.max(1, Math.round(t * (points.length - 1)))
        const slice = points.slice(0, count + 1)
        casing.setLatLngs(slice)
        line.setLatLngs(slice)
        if (t < 1) requestAnimationFrame(frame)
        else resolve()
      }
      requestAnimationFrame(frame)
    })
  }

  async function presentStop(stop: typeof places[number], at: L.LatLng, token: number) {
    const map = mapRef.current
    if (!map) return
    map.flyTo(at, 6.2, { duration: 0.7 })
    await wait(720)
    if (token !== playToken.current) return
    const all = stop.photos ?? []
    const shown = all.slice(0, perStop)
    if (!shown.length) {
      setMemory({ name: stop.name, text: '待添加' })
      await wait(800)
      setMemory(null)
      return
    }
    for (let index = 0; index < shown.length; index += 1) {
      if (token !== playToken.current) return
      const extra = all.length > shown.length ? ` · 共 ${all.length} 张` : ''
      setMemory({
        name: stop.name,
        photo: shown[index],
        text: `${stop.visitedOn ?? ''} · ${index + 1}/${shown.length}${extra}`,
      })
      await wait(1050)
    }
    setMemory(null)
  }

  async function playFootprint() {
    if (playing) {
      playToken.current += 1
      setPlaying(false)
      setMemory(null)
      return
    }
    const stops = datedStops(places, filter)
    const map = mapRef.current
    const layer = ensureRoute()
    if (!map || !layer || stops.length === 0) {
      setCaptureMessage('写了日期的地点才会连成足迹')
      window.setTimeout(() => setCaptureMessage(''), 2200)
      return
    }
    const token = playToken.current + 1
    playToken.current = token
    setPlaying(true)
    setFootprintOn(true)
    layer.clearLayers()
    let cursor = L.latLng(stops[0].lat, stops[0].lng)
    for (let index = 0; index < stops.length; index += 1) {
      if (token !== playToken.current) return
      if (index > 0) {
        const dest = toward(cursor, L.latLng(stops[index].lat, stops[index].lng))
        await animateSegment(cursor, dest, token)
        cursor = dest
      }
      if (token !== playToken.current) return
      await presentStop(stops[index], cursor, token)
    }
    if (token !== playToken.current) return
    setPlaying(false)
    setMemory(null)
    drawDottedRoute(layer, stops)
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
        onPlaceOpen={(place) => setSelectedId(place.id)}
        onMapReady={(map) => {
          mapRef.current = map
          routeRef.current = map ? L.layerGroup().addTo(map) : null
          setMapReady(Boolean(map))
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

      {memory && (
        <section className="memory-card" aria-live="polite">
          <div className="memory-card__frame">
            {memory.photo
              ? <img src={memory.photo} alt="" />
              : <p>待添加</p>}
          </div>
          <b>{memory.name}</b>
          <span>{memory.text}</span>
        </section>
      )}

      {selected && (
        <PlacePhotoSheet
          place={selected}
          onClose={() => setSelectedId(null)}
          onAddPhotos={(files) => {
            void filesToPhotoUrls(files).then((urls) => attachPhotos(selected.id, urls))
          }}
          onVisitedOnChange={(visitedOn) => {
            void updateVisitedOn(selected.id, visitedOn)
          }}
        />
      )}

      <BottomCard
        places={places}
        filter={filter}
        onFilterChange={setFilter}
        onAddPlace={() => openAddPlace(null)}
        footprintOn={footprintOn}
        playing={playing}
        perStop={perStop}
        onToggleFootprint={() => {
          if (playing) {
            playToken.current += 1
            setPlaying(false)
            setMemory(null)
          }
          setFootprintOn((on) => !on)
        }}
        onPlay={() => { void playFootprint() }}
        onPerStop={setPerStop}
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
