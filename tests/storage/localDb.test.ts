import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearAll,
  listPlaces,
  loadBook,
  loadMember,
  saveBook,
  saveSession,
  upsertPlace,
} from '../../src/storage/localDb'

beforeEach(async () => {
  await clearAll()
  await saveBook({
    id: 'book1',
    inviteCode: 'MAP7YK',
    markerPack: 'stars',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
})

describe('saveSession', () => {
  it('writes the book and member together', async () => {
    const book = {
      id: 'book-session',
      inviteCode: 'PAIR42',
      markerPack: 'stars' as const,
      createdAt: '2026-08-10T00:00:00.000Z',
    }
    const member = {
      id: 'member-session',
      bookId: book.id,
      role: 'rabbit' as const,
      deviceToken: 'device-session',
      joinedAt: '2026-08-10T00:00:00.000Z',
    }

    await saveSession(book, member)

    expect(await loadBook()).toEqual(book)
    expect(await loadMember()).toEqual(member)
  })
})

describe('upsertPlace', () => {
  it('upgrades visitor when same place re-added by other role', async () => {
    await upsertPlace({
      id: 'p1',
      bookId: 'book1',
      placeType: 'city',
      name: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6,
      lng: 139.7,
      visitor: 'rabbit',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const merged = await upsertPlace({
      id: 'p2',
      bookId: 'book1',
      placeType: 'city',
      name: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6,
      lng: 139.7,
      visitor: 'dog',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(merged.visitor).toBe('together')
    const all = await listPlaces()
    expect(all).toHaveLength(1)
    expect(all[0]!.visitor).toBe('together')
  })
})
