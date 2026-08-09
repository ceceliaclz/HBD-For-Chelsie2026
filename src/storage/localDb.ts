import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CoupleBook, Member, Place } from '../domain/types'
import { mergeVisitor } from '../domain/visitorUpgrade'
import { newId } from '../lib/id'
import { META_KEYS, placeKey } from './keys'

interface CoupleTravelDB extends DBSchema {
  meta: {
    key: string
    value: unknown
  }
  places: {
    key: string
    value: Place
  }
}

const DB_NAME = 'couple-travel'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<CoupleTravelDB>> | null = null

function getDb(): Promise<IDBPDatabase<CoupleTravelDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CoupleTravelDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('meta')
        db.createObjectStore('places', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export async function getDeviceToken(): Promise<string> {
  const db = await getDb()
  const existing = (await db.get('meta', META_KEYS.deviceToken)) as string | undefined
  if (existing) return existing
  const token = newId()
  await db.put('meta', token, META_KEYS.deviceToken)
  return token
}

export async function saveBook(book: CoupleBook): Promise<void> {
  const db = await getDb()
  await db.put('meta', book, META_KEYS.book)
}

export async function loadBook(): Promise<CoupleBook | null> {
  const db = await getDb()
  const book = (await db.get('meta', META_KEYS.book)) as CoupleBook | undefined
  return book ?? null
}

export async function saveMember(member: Member): Promise<void> {
  const db = await getDb()
  await db.put('meta', member, META_KEYS.member)
}

export async function loadMember(): Promise<Member | null> {
  const db = await getDb()
  const member = (await db.get('meta', META_KEYS.member)) as Member | undefined
  return member ?? null
}

export async function upsertPlace(incoming: Place): Promise<Place> {
  const db = await getDb()
  const key = placeKey(incoming)
  const all = await db.getAll('places')
  const existing = all.find((p) => placeKey(p) === key)

  if (existing) {
    const merged: Place = {
      ...existing,
      ...incoming,
      id: existing.id,
      visitor: mergeVisitor(existing.visitor, incoming.visitor),
      updatedAt: incoming.updatedAt,
    }
    await db.put('places', merged)
    return merged
  }

  await db.put('places', incoming)
  return incoming
}

export async function listPlaces(): Promise<Place[]> {
  const db = await getDb()
  return db.getAll('places')
}

export async function replaceAllPlaces(places: Place[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('places', 'readwrite')
  await tx.store.clear()
  for (const place of places) {
    await tx.store.put(place)
  }
  await tx.done
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['meta', 'places'], 'readwrite')
  await tx.objectStore('meta').clear()
  await tx.objectStore('places').clear()
  await tx.done
  db.close()
  dbPromise = null
}
