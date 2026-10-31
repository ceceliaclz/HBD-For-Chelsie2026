import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAll,
  listPlaces,
  loadBook,
  loadMember,
  upsertPlace,
} from '../../src/storage/localDb'

const syncMocks = vi.hoisted(() => ({
  createBookRemote: vi.fn(),
  joinBookRemote: vi.fn(),
  mergePlacesByUpdatedAt: vi.fn((local: unknown[], remote: unknown[]) => [
    ...local,
    ...remote,
  ]),
  pullPlaces: vi.fn(),
  pushDirtyPlaces: vi.fn(),
  rebindPlacesToBook: vi.fn((places: Array<Record<string, unknown>>, bookId: string) =>
    places.map((place) => ({ ...place, bookId }))),
  resumeSharedBook: vi.fn(),
  syncNow: vi.fn(),
}))

const supabaseMocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}))

vi.mock('../../src/sync/syncEngine', () => syncMocks)
vi.mock('../../src/sync/supabaseClient', () => supabaseMocks)

import { createCoupleBook, initialSyncStatus, joinCoupleBook, openSharedCoupleBook } from '../../src/state/bookStore'

beforeEach(async () => {
  await clearAll()
  vi.clearAllMocks()
  supabaseMocks.getSupabase.mockReturnValue(null)
})

describe('initialSyncStatus', () => {
  it('does not claim success before a completed sync', () => {
    expect(initialSyncStatus({ online: true, configured: true })).toBe('offline')
    expect(initialSyncStatus({ online: true, configured: false })).toBe('offline')
    expect(initialSyncStatus({ online: false, configured: true })).toBe('offline')
  })
})

describe('book onboarding actions', () => {
  it('creates and saves a local couple book when cloud sync is unavailable', async () => {
    const result = await createCoupleBook('rabbit')

    expect(result.book.inviteCode).toHaveLength(6)
    expect(result.member.role).toBe('rabbit')
    expect(syncMocks.createBookRemote).not.toHaveBeenCalled()
    expect(await loadBook()).toEqual(result.book)
    expect(await loadMember()).toEqual(result.member)
  })

  it('still saves a local rabbit session when cloud creation fails', async () => {
    supabaseMocks.getSupabase.mockReturnValue({})
    syncMocks.createBookRemote.mockRejectedValue(new Error('network unavailable'))

    const result = await createCoupleBook('rabbit')

    expect(result.member.role).toBe('rabbit')
    expect(await loadBook()).toEqual(result.book)
    expect(await loadMember()).toEqual(result.member)
  })

  it('joins remotely, merges local and remote places, then uploads the union', async () => {
    const book = {
      id: 'book-remote',
      inviteCode: 'MAP7YK',
      markerPack: 'animals' as const,
      createdAt: '2026-08-10T00:00:00.000Z',
    }
    syncMocks.joinBookRemote.mockResolvedValue({ book, members: [] })
    await upsertPlace({
      id: 'local-place',
      bookId: 'old-local-book',
      placeType: 'city',
      name: '大阪',
      countryCode: 'JP',
      lat: 34.69,
      lng: 135.5,
      visitor: 'dog',
      updatedAt: '2026-08-09T00:00:00.000Z',
    })
    syncMocks.pullPlaces.mockResolvedValue([
      {
        id: 'place-1',
        bookId: book.id,
        placeType: 'city',
        name: '东京',
        countryCode: 'JP',
        lat: 35.67,
        lng: 139.65,
        visitor: 'rabbit',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ])

    const result = await joinCoupleBook('map7yk', 'dog')

    expect(syncMocks.joinBookRemote).toHaveBeenCalledWith(expect.objectContaining({
      inviteCode: 'MAP7YK',
      member: expect.objectContaining({ role: 'dog' }),
    }))
    expect(result.book).toEqual(book)
    expect((await loadMember())?.bookId).toBe(book.id)
    expect(syncMocks.pushDirtyPlaces).toHaveBeenCalledWith(
      book.id,
      expect.arrayContaining([
        expect.objectContaining({ name: '大阪', bookId: book.id }),
        expect.objectContaining({ name: '东京', bookId: book.id }),
      ]),
    )
    expect(await listPlaces()).toHaveLength(2)
  })

  it('keeps the original local places when pulling joined places fails', async () => {
    const book = {
      id: 'book-remote',
      inviteCode: 'MAP7YK',
      markerPack: 'animals' as const,
      createdAt: '2026-08-10T00:00:00.000Z',
    }
    const localPlace = {
      id: 'local-place',
      bookId: book.id,
      placeType: 'city' as const,
      name: 'Osaka',
      countryCode: 'JP',
      lat: 34.69,
      lng: 135.5,
      visitor: 'dog' as const,
      updatedAt: '2026-08-10T00:00:00.000Z',
    }
    await upsertPlace(localPlace)
    syncMocks.joinBookRemote.mockResolvedValue({ book, members: [] })
    syncMocks.pullPlaces.mockRejectedValue(new Error('network unavailable'))

    await expect(joinCoupleBook('map7yk', 'dog'))
      .rejects.toThrow('network unavailable')

    expect(await loadBook()).toBeNull()
    expect(await loadMember()).toBeNull()
    expect(await listPlaces()).toEqual([localPlace])
  })

  it('replaces a different local book with the shared cloud places and their dates', async () => {
    await upsertPlace({
      id: 'empty-book-place',
      bookId: 'new-book',
      placeType: 'city',
      name: '误开的地图',
      countryCode: 'CN',
      lat: 39.9,
      lng: 116.4,
      visitor: 'rabbit',
      updatedAt: '2026-10-31T00:00:00.000Z',
    })
    const sharedBook = {
      id: 'shared-book',
      inviteCode: 'X5MPHP',
      markerPack: 'stars' as const,
      createdAt: '2026-08-13T00:00:00.000Z',
    }
    const sharedMember = {
      id: 'rabbit-member',
      bookId: sharedBook.id,
      role: 'rabbit' as const,
      deviceToken: 'this-device',
      joinedAt: '2026-08-13T00:00:00.000Z',
    }
    syncMocks.resumeSharedBook.mockResolvedValue({
      book: sharedBook,
      member: sharedMember,
      places: [{
        id: 'nanjing',
        bookId: sharedBook.id,
        placeType: 'city',
        name: '南京',
        countryCode: 'CN',
        lat: 32.06,
        lng: 118.78,
        visitor: 'together',
        visitedOn: '2019-02-01',
        updatedAt: '2026-08-13T00:00:00.000Z',
      }],
    })

    const result = await openSharedCoupleBook('rabbit')

    expect(result.book).toEqual(sharedBook)
    expect(result.member).toEqual(sharedMember)
    expect(syncMocks.pushDirtyPlaces).not.toHaveBeenCalled()
    expect(await listPlaces()).toEqual([
      expect.objectContaining({ name: '南京', visitedOn: '2019-02-01' }),
    ])
  })
})
