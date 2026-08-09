import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoupleBook, Member, Place } from '../../src/domain/types'

const localDbMocks = vi.hoisted(() => ({
  listPlaces: vi.fn(),
  loadBook: vi.fn(),
  replaceAllPlaces: vi.fn(),
}))
const supabaseMocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}))

vi.mock('../../src/storage/localDb', () => localDbMocks)
vi.mock('../../src/sync/supabaseClient', () => supabaseMocks)

import {
  createBookRemote,
  joinBookRemote,
  mergePlacesByUpdatedAt,
  RoleTakenError,
  syncNow,
} from '../../src/sync/syncEngine'

const book: CoupleBook = {
  id: 'book-id',
  inviteCode: 'ABC123',
  markerPack: 'animals',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const member: Member = {
  id: 'member-id',
  bookId: 'book-id',
  role: 'rabbit',
  deviceToken: 'device-token',
  joinedAt: '2026-01-01T00:00:00.000Z',
}

const localPlace: Place = {
  id: 'local-id',
  bookId: 'book-id',
  placeType: 'city',
  name: 'Tokyo',
  countryCode: 'JP',
  lat: 35.6762,
  lng: 139.6503,
  visitor: 'rabbit',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mergePlacesByUpdatedAt', () => {
  it('prefers the place with the newer updatedAt timestamp', () => {
    const remote: Place = {
      ...localPlace,
      id: 'remote-id',
      visitor: 'together',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }

    const merged = mergePlacesByUpdatedAt([localPlace], [remote])

    expect(merged).toEqual([remote])
  })
})

describe('syncNow', () => {
  it('returns offline without reading local state when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    await expect(syncNow()).resolves.toBe('offline')
    expect(localDbMocks.loadBook).not.toHaveBeenCalled()
  })

  it('returns no-book when no local couple book exists', async () => {
    localDbMocks.loadBook.mockResolvedValue(null)

    await expect(syncNow()).resolves.toBe('no-book')
  })

  it('pulls, merges, replaces locally, then pushes the merged places', async () => {
    const calls: string[] = []
    const remotePlace: Place = {
      ...localPlace,
      id: 'remote-id',
      visitor: 'together',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => {
            calls.push('pull')
            return {
              data: [{
                id: remotePlace.id,
                book_id: remotePlace.bookId,
                place_type: remotePlace.placeType,
                name: remotePlace.name,
                country_code: remotePlace.countryCode,
                lat: remotePlace.lat,
                lng: remotePlace.lng,
                visitor: remotePlace.visitor,
                visited_on: null,
                updated_at: remotePlace.updatedAt,
              }],
              error: null,
            }
          }),
        })),
        upsert: vi.fn(async (rows: unknown) => {
          calls.push('push')
          expect(rows).toEqual([expect.objectContaining({
            id: remotePlace.id,
            visitor: 'together',
            updated_at: remotePlace.updatedAt,
          })])
          return { error: null }
        }),
      })),
    }
    localDbMocks.loadBook.mockResolvedValue(book)
    localDbMocks.listPlaces.mockResolvedValue([localPlace])
    localDbMocks.replaceAllPlaces.mockImplementation(async (places) => {
      calls.push('replace')
      expect(places).toEqual([remotePlace])
    })
    supabaseMocks.getSupabase.mockReturnValue(supabase)

    await expect(syncNow()).resolves.toBe('ok')
    expect(calls).toEqual(['pull', 'replace', 'push'])
  })
})

describe('joinBookRemote', () => {
  it('maps a concurrent role unique violation to RoleTakenError', async () => {
    const memberRows = [{
      id: 'other-member',
      book_id: book.id,
      role: member.role,
      device_token: 'other-device',
      joined_at: member.joinedAt,
    }]
    let memberReadCount = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'couple_books') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: book.id,
                    invite_code: book.inviteCode,
                    marker_pack: book.markerPack,
                    created_at: book.createdAt,
                  },
                  error: null,
                })),
              })),
            })),
          }
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: memberReadCount++ === 0 ? [] : memberRows,
              error: null,
            })),
          })),
          insert: vi.fn(async () => ({
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "members_book_id_role_key"',
            },
          })),
        }
      }),
    }
    supabaseMocks.getSupabase.mockReturnValue(supabase)

    await expect(joinBookRemote({
      inviteCode: book.inviteCode,
      member,
    })).rejects.toBeInstanceOf(RoleTakenError)
    expect(memberReadCount).toBe(2)
  })
})

describe('createBookRemote', () => {
  it('deletes the orphan book when inserting its first member fails', async () => {
    const deleteEq = vi.fn(async () => ({ error: null }))
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'couple_books') {
          return {
            insert: vi.fn(async () => ({ error: null })),
            delete: vi.fn(() => ({ eq: deleteEq })),
          }
        }
        return {
          insert: vi.fn(async () => ({
            error: { code: '42501', message: 'member insert failed' },
          })),
        }
      }),
    }
    supabaseMocks.getSupabase.mockReturnValue(supabase)

    await expect(createBookRemote({ book, member })).rejects.toMatchObject({
      message: 'member insert failed',
    })
    expect(deleteEq).toHaveBeenCalledWith('id', book.id)
  })
})
