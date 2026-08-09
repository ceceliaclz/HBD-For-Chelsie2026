import { describe, it, expect } from 'vitest'
import { computeStats } from '../../src/domain/stats'
import type { Place } from '../../src/domain/types'

const base = {
  bookId: 'b1',
  lat: 0,
  lng: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('computeStats', () => {
  it('counts unique countries, cities, together', () => {
    const places: Place[] = [
      { ...base, id: '1', placeType: 'city', name: 'Tokyo', countryCode: 'JP', visitor: 'together' },
      { ...base, id: '2', placeType: 'city', name: 'Osaka', countryCode: 'JP', visitor: 'rabbit' },
      { ...base, id: '3', placeType: 'country', name: 'France', countryCode: 'FR', visitor: 'dog' },
    ]
    expect(computeStats(places)).toEqual({
      countryCount: 2,
      cityCount: 2,
      togetherCount: 1,
    })
  })
})
