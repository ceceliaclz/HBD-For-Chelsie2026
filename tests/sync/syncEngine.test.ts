import { describe, expect, it } from 'vitest'
import type { Place } from '../../src/domain/types'
import { mergePlacesByUpdatedAt } from '../../src/sync/syncEngine'

describe('mergePlacesByUpdatedAt', () => {
  it('prefers the place with the newer updatedAt timestamp', () => {
    const local: Place = {
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
    const remote: Place = {
      ...local,
      id: 'remote-id',
      visitor: 'together',
      updatedAt: '2026-01-03T00:00:00.000Z',
    }

    const merged = mergePlacesByUpdatedAt([local], [remote])

    expect(merged).toEqual([remote])
  })
})
