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
  pullPlaces: vi.fn(),
}))

const supabaseMocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}))

vi.mock('../../src/sync/syncEngine', () => syncMocks)
vi.mock('../../src/sync/supabaseClient', () => supabaseMocks)

import { createCoupleBook, joinCoupleBook } from '../../src/state/bookStore'

beforeEach(async () => {
  await clearAll()
  vi.clearAllMocks()
  supabaseMocks.getSupabase.mockReturnValue(null)
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

  it('does not save a local session when configured cloud creation fails', async () => {
    supabaseMocks.getSupabase.mockReturnValue({})
    syncMocks.createBookRemote.mockRejectedValue(new Error('network unavailable'))

    await expect(createCoupleBook('rabbit')).rejects.toThrow('network unavailable')

    expect(await loadBook()).toBeNull()
    expect(await loadMember()).toBeNull()
  })

  it('joins remotely, saves membership and pulls shared places', async () => {
    const book = {
      id: 'book-remote',
      inviteCode: 'MAP7YK',
      markerPack: 'animals' as const,
      createdAt: '2026-08-10T00:00:00.000Z',
    }
    syncMocks.joinBookRemote.mockResolvedValue({ book, members: [] })
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
    expect(await listPlaces()).toHaveLength(1)
  })

  it('keeps the joined local session when pulling places fails', async () => {
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

    const result = await joinCoupleBook('map7yk', 'dog')

    expect(result.book).toEqual(book)
    expect(await loadBook()).toEqual(book)
    expect((await loadMember())?.bookId).toBe(book.id)
    expect(await listPlaces()).toEqual([localPlace])
  })
})
