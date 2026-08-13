import { describe, expect, it } from 'vitest'
import {
  approxPlaceFromLngLat,
  haversineKm,
  nearestCity,
} from '../../src/geo/reverseApprox'
import type { CityHit } from '../../src/geo/citySearch'

const tokyo: CityHit = {
  name: 'Tokyo',
  countryCode: 'JP',
  countryName: 'Japan',
  lat: 35.6762,
  lng: 139.6503,
}

describe('haversineKm', () => {
  it('calculates the great-circle distance between known cities', () => {
    const distance = haversineKm(
      { lat: 35.6762, lng: 139.6503 },
      { lat: 34.6937, lng: 135.5023 },
    )

    expect(distance).toBeCloseTo(392.4, 1)
  })
})

describe('nearestCity', () => {
  it('returns the nearest city inside the maximum distance', () => {
    const paris: CityHit = {
      name: 'Paris',
      countryCode: 'FR',
      countryName: 'France',
      lat: 48.8566,
      lng: 2.3522,
    }

    expect(nearestCity({ lat: 35.7, lng: 139.7 }, [paris, tokyo])).toBe(tokyo)
  })

  it('returns null when every city is outside the maximum distance', () => {
    expect(nearestCity({ lat: 0, lng: 0 }, [tokyo], 80)).toBeNull()
  })
})

describe('approxPlaceFromLngLat', () => {
  it('finds both the containing country and a nearby seeded city', () => {
    const result = approxPlaceFromLngLat({ lat: 35.68, lng: 139.65 })
    expect(result.countryCode).toBe('JP')
    expect(result.countryName).toBe('Japan')
    expect(result.nearestCity).toMatchObject(tokyo)
  })

  it('returns only the country when no seeded city is within 80km', () => {
    const result = approxPlaceFromLngLat({ lat: 46.5, lng: 2.5 })

    expect(result.countryCode).toBe('FR')
    expect(result.countryName).toBe('France')
    expect(result.nearestCity).toBeUndefined()
  })
})
