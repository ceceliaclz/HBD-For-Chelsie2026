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
  saveBook,
  saveMember,
  upsertPlace,
} from '../storage/localDb'
import {
  createBookRemote,
  joinBookRemote,
  pullPlaces,
} from '../sync/syncEngine'

const DEV_BOOK_ID = 'local-dev-book'

export interface BookSession {
  book: CoupleBook
  member: Member
}

function isCloudNotConfigured(error: unknown): boolean {
  return error instanceof Error && error.message === 'Supabase is not configured'
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

  await saveBook(book)
  await saveMember(member)
  try {
    await createBookRemote({ book, member })
  } catch (error) {
    if (!isCloudNotConfigured(error)) throw error
  }
  return { book, member }
}

export async function joinCoupleBook(code: string, role: Role): Promise<BookSession> {
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
  const places = await pullPlaces(book.id)

  await saveBook(book)
  await saveMember(joinedMember)
  await replaceAllPlaces(places)
  return { book, member: joinedMember }
}

export function useBookStore(initialPlaces?: Place[]) {
  const [places, setPlaces] = useState<Place[]>(initialPlaces ?? [])
  const [book, setBook] = useState<CoupleBook | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [ready, setReady] = useState(initialPlaces !== undefined)

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

  const addPlace = useCallback(async (
    hit: CityHit & { placeType: Place['placeType'] },
    visitor: Visitor,
    visitedOn?: string,
  ) => {
    const book = await loadBook()
    await upsertPlace({
      id: newId(),
      bookId: book?.id ?? DEV_BOOK_ID,
      placeType: hit.placeType,
      name: hit.name,
      countryCode: hit.countryCode,
      lat: hit.lat,
      lng: hit.lng,
      visitor,
      ...(visitedOn ? { visitedOn } : {}),
      updatedAt: new Date().toISOString(),
    })
    setPlaces(await listPlaces())
  }, [])

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

  const setCurrentBook = useCallback((nextBook: CoupleBook) => {
    setBook(nextBook)
  }, [])

  return {
    book,
    member,
    places,
    ready,
    addPlace,
    createBook,
    joinBook,
    setCurrentBook,
  }
}
