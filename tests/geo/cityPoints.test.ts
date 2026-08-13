import { describe, expect, it } from 'vitest'
import {
  cityAuraGeoJson,
  cityPlacesForFilter,
  heartRing,
} from '../../src/geo/cityPoints'
import type { Place } from '../../src/domain/types'

function place(partial: Partial<Place> & Pick<Place, 'name' | 'lng' | 'lat'>): Place {
  return {
    id: partial.id ?? 'p1',
    bookId: 'book',
    placeType: 'city',
    countryCode: 'CN',
    visitor: 'together',
    updatedAt: '2026-08-13T00:00:00.000Z',
    ...partial,
  }
}

describe('cityPoints', () => {
  it('filters only city places', () => {
    const places = [
      place({ name: '南京', lng: 118.78, lat: 32.06 }),
      {
        ...place({ name: '中国', lng: 105, lat: 35 }),
        placeType: 'country' as const,
      },
    ]
    expect(cityPlacesForFilter(places, 'all')).toHaveLength(1)
  })

  it('builds a closed heart ring for city outlines', () => {
    const ring = heartRing(118.78, 32.06, 14, 36)
    expect(ring.length).toBe(37)
    expect(ring[0]?.[0]).toBeCloseTo(ring.at(-1)?.[0] ?? 0, 5)
    expect(ring[0]?.[1]).toBeCloseTo(ring.at(-1)?.[1] ?? 0, 5)

    const lats = ring.map((point) => point[1])
    const lngs = ring.map((point) => point[0])
    // Heart should span both axes around the center (not a tiny blob).
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0.1)
    expect(Math.max(...lngs) - Math.min(...lngs)).toBeGreaterThan(0.1)
  })

  it('exports heart-shaped aura polygons for visited cities', () => {
    const geo = cityAuraGeoJson(
      [place({ name: '南京', lng: 118.78, lat: 32.06 })],
      'all',
    )
    expect(geo.features).toHaveLength(1)
    expect(geo.features[0]?.geometry.type).toBe('Polygon')
    expect(geo.features[0]?.geometry.coordinates[0]?.length).toBeGreaterThan(20)
  })
})
