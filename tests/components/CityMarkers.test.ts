import { describe, expect, it } from 'vitest'
import { cityPlacesForFilter } from '../../src/components/CityMarkers'
import type { Place } from '../../src/domain/types'

const base = {
  bookId: 'b1',
  lat: 0,
  lng: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const places: Place[] = [
  { ...base, id: '1', placeType: 'city', name: 'Tokyo', countryCode: 'JP', visitor: 'together' },
  { ...base, id: '2', placeType: 'city', name: 'Osaka', countryCode: 'JP', visitor: 'rabbit' },
  { ...base, id: '3', placeType: 'country', name: 'France', countryCode: 'FR', visitor: 'dog' },
]

describe('cityPlacesForFilter', () => {
  it('returns all city places for the all filter', () => {
    expect(cityPlacesForFilter(places, 'all').map((place) => place.id)).toEqual(['1', '2'])
  })

  it('returns only matching city places for a visitor filter', () => {
    expect(cityPlacesForFilter(places, 'rabbit').map((place) => place.id)).toEqual(['2'])
  })
})
