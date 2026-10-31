import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Onboarding } from './components/Onboarding'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import type { Place, Role } from './domain/types'
import { canShowSharedMap } from './sharedGate'
import { useBookStore } from './state/bookStore'
import { SHARED_BOOK_ID, SHARED_INVITE_CODE } from './sync/syncEngine'

function requestedRole(): Role | null {
  const role = new URLSearchParams(window.location.search).get('as')
  return role === 'rabbit' || role === 'dog' ? role : null
}

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
    openShared,
    setCurrentBook,
  } = useBookStore()
  const [enterError, setEnterError] = useState('')
  const autoRole = requestedRole()
  const wrongBook = book !== null && (
    book.inviteCode !== SHARED_INVITE_CODE || book.id !== SHARED_BOOK_ID
  )
  const roleMismatch = autoRole !== null && member !== null && member.role !== autoRole
  const needShared = (autoRole !== null && book === null) || wrongBook || roleMismatch
  const sharedRole: Role = autoRole ?? member?.role ?? 'rabbit'
  const showingShared = book !== null && member !== null && canShowSharedMap(ready, book.inviteCode)

  useEffect(() => {
    if (!ready || !needShared || enterError) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!cancelled) setEnterError('云端太慢了，过一会儿再打开这个链接')
    }, 8000)
    void openShared(sharedRole)
      .then(() => {
        if (!cancelled) setEnterError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setEnterError(error instanceof Error ? error.message : '没能打开你们的地图')
      })
      .finally(() => window.clearTimeout(timer))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [enterError, needShared, openShared, ready, sharedRole])

  if (debugPlaces) return <HomePage places={debugPlaces} />
  if (book && member && showingShared) {
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
  if (!ready || (needShared && !enterError)) {
    return (
      <main className="app-loading" aria-label="正在打开你们的地图">
        <p>正在打开你们的地图</p>
      </main>
    )
  }
  if (needShared && enterError) {
    return (
      <main className="app-loading" aria-label="没能打开你们的地图">
        <p>没能打开你们一起的地图。</p>
        <p>{enterError}</p>
        <button type="button" onClick={() => setEnterError('')}>再试一次</button>
      </main>
    )
  }
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
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/join/:code?" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
