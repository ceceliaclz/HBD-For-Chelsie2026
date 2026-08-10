import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Onboarding } from './components/Onboarding'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import type { Place } from './domain/types'
import { useBookStore } from './state/bookStore'

const DEBUG_PLACES: Place[] = [
  {
    id: 'debug-tokyo',
    bookId: 'debug',
    placeType: 'city',
    name: '东京',
    countryCode: 'JP',
    lat: 35.6762,
    lng: 139.6503,
    visitor: 'together',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
  {
    id: 'debug-paris',
    bookId: 'debug',
    placeType: 'city',
    name: '巴黎',
    countryCode: 'FR',
    lat: 48.8566,
    lng: 2.3522,
    visitor: 'rabbit',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
  {
    id: 'debug-bali',
    bookId: 'debug',
    placeType: 'city',
    name: '巴厘岛',
    countryCode: 'ID',
    lat: -8.4095,
    lng: 115.1889,
    visitor: 'dog',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
]

function RootPage() {
  const debugPlaces = import.meta.env.DEV && window.location.hash === '#debug'
    ? DEBUG_PLACES
    : undefined
  const {
    book,
    member,
    places,
    ready,
    createBook,
    setCurrentBook,
  } = useBookStore()

  if (debugPlaces) return <HomePage places={debugPlaces} />
  if (!ready) return <main className="app-loading" aria-label="正在加载">✦</main>
  if (!book || !member) return <Onboarding onCreate={createBook} />

  return (
    <HomePage
      places={places}
      book={book}
      member={member}
      markerPack={book.markerPack}
      onBookChange={setCurrentBook}
    />
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/join/:code?" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
