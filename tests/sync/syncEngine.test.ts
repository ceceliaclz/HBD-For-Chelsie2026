import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoupleBook, Member, Place } from '../../src/domain/types'

const localDbMocks = vi.hoisted(() => ({
  listPlaces: vi.fn(),
  loadBook: vi.fn(),
  loadMember: vi.fn(),
  replaceAllPlaces: vi.fn(),
}))
const supabaseMocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}))

vi.mock('../../src/storage/localDb', () => localDbMocks)
vi.mock('../../src/sync/supabaseClient', () => supabaseMocks)

import {
  createBookRemote,
  ensureSessionRemote,
  joinBookRemote,
  mergePlacesByUpdatedAt,
  rebindPlacesToBook,
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

  it('keeps local photos when the newer remote row has none', () => {
    const remote: Place = {
      ...localPlace,
      id: 'remote-id',
      visitor: 'together',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }
    const localWithPhotos: Place = {
      ...localPlace,
      photos: ['data:image/jpeg;base64,abc'],
    }

    const merged = mergePlacesByUpdatedAt([localWithPhotos], [remote])

    expect(merged).toEqual([{ ...remote, photos: localWithPhotos.photos }])
  })
})

describe('rebindPlacesToBook', () => {
  it('moves preserved local places into the active cloud book', () => {
    expect(rebindPlacesToBook([localPlace], 'joined-book')).toEqual([
      { ...localPlace, bookId: 'joined-book' },
    ])
  })
})

describe('ensureSessionRemote', () => {
  it('upserts the local book before its member', async () => {
    const calls: string[] = []
    const bookUpsert = vi.fn(async () => {
      calls.push('book')
      return { error: null }
    })
    const memberUpsert = vi.fn(async () => {
      calls.push('member')
      return { error: null }
    })
    supabaseMocks.getSupabase.mockReturnValue({
      from: vi.fn((table: string) => ({
        upsert: table === 'couple_books' ? bookUpsert : memberUpsert,
      })),
    })

    await ensureSessionRemote({ book, member })

    expect(calls).toEqual(['book', 'member'])
    expect(bookUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: book.id, invite_code: book.inviteCode }),
      { onConflict: 'id' },
    )
    expect(memberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: member.id, book_id: book.id }),
      { onConflict: 'id' },
    )
  })

  it('does not write a member if the book write fails', async () => {
    const memberUpsert = vi.fn()
    supabaseMocks.getSupabase.mockReturnValue({
      from: vi.fn((table: string) => ({
        upsert: table === 'couple_books'
          ? vi.fn(async () => ({ error: new Error('book write failed') }))
          : memberUpsert,
      })),
    })

    await expect(ensureSessionRemote({ book, member }))
      .rejects.toThrow('book write failed')
    expect(memberUpsert).not.toHaveBeenCalled()
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

  it('ensures the session, pulls, pushes, then replaces local places', async () => {
    const calls: string[] = []
    const remotePlace: Place = {
      ...localPlace,
      id: 'remote-id',
      visitor: 'together',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'couple_books' || table === 'members') {
          return {
            upsert: vi.fn(async () => {
              if (table === 'members') calls.push('ensure-session')
              return { error: null }
            }),
          }
        }
        return {
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
        }
      }),
    }
    localDbMocks.loadBook.mockResolvedValue(book)
    localDbMocks.loadMember.mockResolvedValue(member)
    localDbMocks.listPlaces.mockResolvedValue([localPlace])
    localDbMocks.replaceAllPlaces.mockImplementation(async (places) => {
      calls.push('replace')
      expect(places).toEqual([remotePlace])
    })
    supabaseMocks.getSupabase.mockReturnValue(supabase)

    await expect(syncNow()).resolves.toBe('ok')
    expect(calls).toEqual(['ensure-session', 'pull', 'push', 'replace'])
  })

  it('preserves and uploads local places when the remote list is empty', async () => {
    const calls: string[] = []
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'couple_books' || table === 'members') {
          return { upsert: vi.fn(async () => ({ error: null })) }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => {
              calls.push('pull')
              return { data: [], error: null }
            }),
          })),
          upsert: vi.fn(async (rows: unknown) => {
            calls.push('push')
            expect(rows).toEqual([expect.objectContaining({
              id: localPlace.id,
              name: localPlace.name,
            })])
            return { error: null }
          }),
        }
      }),
    }
    localDbMocks.loadBook.mockResolvedValue(book)
    localDbMocks.loadMember.mockResolvedValue(member)
    localDbMocks.listPlaces.mockResolvedValue([localPlace])
    localDbMocks.replaceAllPlaces.mockImplementation(async (places) => {
      calls.push('replace')
      expect(places).toEqual([localPlace])
    })
    supabaseMocks.getSupabase.mockReturnValue(supabase)

    await expect(syncNow()).resolves.toBe('ok')
    expect(calls).toEqual(['pull', 'push', 'replace'])
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
