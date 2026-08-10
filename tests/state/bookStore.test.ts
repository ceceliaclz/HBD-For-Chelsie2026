import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAll, listPlaces, loadBook, loadMember } from '../../src/storage/localDb'

const syncMocks = vi.hoisted(() => ({
  createBookRemote: vi.fn(),
  joinBookRemote: vi.fn(),
  pullPlaces: vi.fn(),
}))

vi.mock('../../src/sync/syncEngine', () => syncMocks)

import { createCoupleBook, joinCoupleBook } from '../../src/state/bookStore'

beforeEach(async () => {
  await clearAll()
  vi.clearAllMocks()
})

describe('book onboarding actions', () => {
  it('creates and saves a local couple book when cloud sync is unavailable', async () => {
    syncMocks.createBookRemote.mockRejectedValue(new Error('Supabase is not configured'))

    const result = await createCoupleBook('rabbit')

    expect(result.book.inviteCode).toHaveLength(6)
    expect(result.member.role).toBe('rabbit')
    expect(await loadBook()).toEqual(result.book)
    expect(await loadMember()).toEqual(result.member)
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
})
