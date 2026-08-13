import { describe, expect, it, vi } from 'vitest'
import { fitMapToPlaces, placesBoundsPadding } from '../../src/geo/fitPlaces'
import type { Place } from '../../src/domain/types'

function place(partial: Partial<Place> & Pick<Place, 'lng' | 'lat'>): Place {
  return {
    id: 'p1',
    placeType: 'city',
    name: 'Test',
    countryCode: 'CN',
    countryName: 'China',
    visitor: 'together',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('fitMapToPlaces', () => {
  it('exposes generous padding so markers clear chrome', () => {
    const padding = placesBoundsPadding()
    expect(padding.top).toBeGreaterThanOrEqual(96)
    expect(padding.bottom).toBeGreaterThanOrEqual(240)
  })

  it('fits bounds for multiple places', () => {
    const fitBounds = vi.fn()
    const easeTo = vi.fn()
    const map = { fitBounds, easeTo, getZoom: () => 1.2 } as never

    fitMapToPlaces(map, [
      place({ lng: 121.47, lat: 31.23 }),
      place({ lng: 116.4, lat: 39.9 }),
    ], { animate: false })

    expect(fitBounds).toHaveBeenCalledTimes(1)
    expect(easeTo).not.toHaveBeenCalled()
  })

  it('centers a single place', () => {
    const fitBounds = vi.fn()
    const easeTo = vi.fn()
    const map = { fitBounds, easeTo, getZoom: () => 1.2 } as never

    fitMapToPlaces(map, [place({ lng: 121.47, lat: 31.23 })], {
      animate: false,
    })

    expect(easeTo).toHaveBeenCalledTimes(1)
    expect(easeTo.mock.calls[0]?.[0]?.zoom).toBeGreaterThanOrEqual(6)
    expect(fitBounds).not.toHaveBeenCalled()
  })
})
