import { HomePage } from './pages/HomePage'
import type { Place } from './domain/types'

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

function App() {
  const places =
    import.meta.env.DEV && window.location.hash === '#debug'
      ? DEBUG_PLACES
      : undefined

  return <HomePage places={places} />
}

export default App
