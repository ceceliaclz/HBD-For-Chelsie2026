import { useCallback, useEffect, useState } from 'react'
import { generateInviteCode, normalizeInviteCode } from '../domain/inviteCode'
import type { CoupleBook, Member, Place, Role, Visitor } from '../domain/types'
import type { CityHit } from '../geo/citySearch'
import { newId } from '../lib/id'
import {
  getDeviceToken,
  listPlaces,
  loadBook,
  loadMember,
  replaceAllPlaces,
  saveSession,
  upsertPlace,
  writePlace,
} from '../storage/localDb'
import {
  createBookRemote,
  joinBookRemote,
  mergePlacesByUpdatedAt,
  pullPlaces,
  pushDirtyPlaces,
  rebindPlacesToBook,
  resumeSharedBook,
  ORIGINAL_COUPLE_BOOK_ID,
  syncNow,
} from '../sync/syncEngine'
import { getSupabase } from '../sync/supabaseClient'

const DEV_BOOK_ID = 'local-dev-book'

export interface BookSession {
  book: CoupleBook
  member: Member
}

export type SyncStatus = 'synced' | 'offline' | 'failed'

export function initialSyncStatus(_input: {
  online: boolean
  configured: boolean
}): SyncStatus {
  return 'offline'
}

interface BookStoreOptions {
  syncLifecycle?: boolean
}

export async function createCoupleBook(role: Role): Promise<BookSession> {
  const now = new Date().toISOString()
  const book: CoupleBook = {
    id: newId(),
    inviteCode: generateInviteCode(),
    markerPack: 'stars',
    createdAt: now,
  }
  const member: Member = {
    id: newId(),
    bookId: book.id,
    role,
    deviceToken: await getDeviceToken(),
    joinedAt: now,
  }

  if (getSupabase()) {
    try {
      await createBookRemote({ book, member })
    } catch {
      // Cloud can be down. The map still opens on this device.
    }
  }
  await saveSession(book, member)
  return { book, member }
}

export async function openSharedCoupleBook(role: Role): Promise<BookSession> {
  const localBook = await loadBook()
  const localPlaces = await listPlaces()
  const { book, member, places: remotePlaces } = await resumeSharedBook({
    role,
    deviceToken: await getDeviceToken(),
  })
  const carryLocalPlaces = localBook?.id === book.id || localBook?.id === ORIGINAL_COUPLE_BOOK_ID
  const nextPlaces = carryLocalPlaces
    ? mergePlacesByUpdatedAt(rebindPlacesToBook(localPlaces, book.id), remotePlaces)
    : remotePlaces
  await saveSession(book, member)
  await replaceAllPlaces(nextPlaces)
  if (carryLocalPlaces) {
    try {
      await pushDirtyPlaces(book.id, nextPlaces)
    } catch {
      // The shared cities are already on this phone. Upload can retry later.
    }
  }
  return { book, member }
}

export async function changePlaceVisitedOn(placeId: string, visitedOn: string): Promise<Place | null> {
  const current = (await listPlaces()).find((place) => place.id === placeId)
  if (!current) return null
  const next: Place = { ...current, updatedAt: new Date().toISOString() }
  if (visitedOn) next.visitedOn = visitedOn
  else delete next.visitedOn
  return writePlace(next)
}

export async function joinCoupleBook(code: string, role: Role): Promise<BookSession> {
  const localPlaces = await listPlaces()
  const member: Member = {
    id: newId(),
    bookId: '',
    role,
    deviceToken: await getDeviceToken(),
    joinedAt: new Date().toISOString(),
  }
  const { book } = await joinBookRemote({
    inviteCode: normalizeInviteCode(code),
    member,
  })
  const joinedMember = { ...member, bookId: book.id }
  const reboundLocalPlaces = rebindPlacesToBook(localPlaces, book.id)
  const remotePlaces = await pullPlaces(book.id)
  const mergedPlaces = mergePlacesByUpdatedAt(
    reboundLocalPlaces,
    remotePlaces,
  )
  await pushDirtyPlaces(book.id, mergedPlaces)
  await saveSession(book, joinedMember)
  await replaceAllPlaces(mergedPlaces)
  return { book, member: joinedMember }
}

export function useBookStore(initialPlaces?: Place[], options: BookStoreOptions = {}) {
  const [places, setPlaces] = useState<Place[]>(initialPlaces ?? [])
  const [book, setBook] = useState<CoupleBook | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [ready, setReady] = useState(initialPlaces !== undefined)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    initialSyncStatus({
      online: typeof navigator !== 'undefined' ? navigator.onLine : false,
      configured: getSupabase() !== null,
    }),
  )

  useEffect(() => {
    let active = true
    if (initialPlaces !== undefined) {
      setPlaces(initialPlaces)
      setReady(true)
      return () => {
        active = false
      }
    }

    void Promise.all([listPlaces(), loadBook(), loadMember()]).then(([savedPlaces, savedBook, savedMember]) => {
      if (active) {
        setPlaces(savedPlaces)
        setBook(savedBook)
        setMember(savedMember)
        setReady(true)
      }
    })
    return () => {
      active = false
    }
  }, [initialPlaces])

  const runSync = useCallback(async () => {
    try {
      const result = await syncNow()
      if (result === 'ok' || result === 'pulled') setPlaces(await listPlaces())
      setSyncStatus(result === 'ok' ? 'synced' : result === 'pulled' ? 'failed' : 'offline')
      return result
    } catch {
      setSyncStatus('failed')
      return 'failed' as const
    }
  }, [])

  useEffect(() => {
    if (!options.syncLifecycle || !ready) return
    void runSync()
  }, [options.syncLifecycle, ready, runSync])

  useEffect(() => {
    if (!options.syncLifecycle) return

    const syncWhenFocused = () => {
      void runSync()
    }
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runSync()
    }, 30_000)

    window.addEventListener('focus', syncWhenFocused)
    return () => {
      window.removeEventListener('focus', syncWhenFocused)
      window.clearInterval(intervalId)
    }
  }, [options.syncLifecycle, runSync])

  const addPlace = useCallback(async (
    hit: CityHit & { placeType: Place['placeType'] },
    visitor: Visitor,
    visitedOn?: string,
    wish?: { note?: string },
  ) => {
    const book = await loadBook()
    const note = wish?.note?.trim()
    await upsertPlace({
      id: newId(),
      bookId: book?.id ?? DEV_BOOK_ID,
      placeType: hit.placeType,
      // Prefer Chinese label on the map when available.
      name: hit.nameZh ?? hit.name,
      countryCode: hit.countryCode,
      lat: hit.lat,
      lng: hit.lng,
      visitor,
      ...(wish ? { status: 'wish' as const } : {}),
      ...(note ? { wishNote: note } : {}),
      ...(!wish && visitedOn ? { visitedOn } : {}),
      updatedAt: new Date().toISOString(),
    })
    setPlaces(await listPlaces())
    await runSync()
  }, [runSync])

  const attachPhotos = useCallback(async (placeId: string, photos: string[]) => {
    if (!photos.length) return
    const current = (await listPlaces()).find((place) => place.id === placeId)
    if (!current) return
    await upsertPlace({
      ...current,
      photos: [...(current.photos ?? []), ...photos],
      updatedAt: new Date().toISOString(),
    })
    setPlaces(await listPlaces())
  }, [])

  const makeVisited = useCallback(async (placeId: string) => {
    const current = (await listPlaces()).find((place) => place.id === placeId)
    if (!current || current.status !== 'wish') return
    const next: Place = { ...current, updatedAt: new Date().toISOString() }
    delete next.status
    await writePlace(next)
    setPlaces(await listPlaces())
    await runSync()
  }, [runSync])

  const updateVisitedOn = useCallback(async (placeId: string, visitedOn: string) => {
    await changePlaceVisitedOn(placeId, visitedOn)
    setPlaces(await listPlaces())
    await runSync()
  }, [runSync])

  const createBook = useCallback(async (role: Role) => {
    const session = await createCoupleBook(role)
    setBook(session.book)
    setMember(session.member)
    return session
  }, [])

  const joinBook = useCallback(async (code: string, role: Role) => {
    const session = await joinCoupleBook(code, role)
    setBook(session.book)
    setMember(session.member)
    setPlaces(await listPlaces())
    return session
  }, [])

  const openShared = useCallback(async (role: Role) => {
    const session = await openSharedCoupleBook(role)
    setBook(session.book)
    setMember(session.member)
    setPlaces(await listPlaces())
    return session
  }, [])

  const setCurrentBook = useCallback((nextBook: CoupleBook) => {
    setBook(nextBook)
  }, [])

  return {
    book,
    member,
    places,
    ready,
    syncStatus,
    addPlace,
    attachPhotos,
    updateVisitedOn,
    makeVisited,
    createBook,
    joinBook,
    openShared,
    setCurrentBook,
  }
}
