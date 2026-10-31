import { describe, expect, it } from 'vitest'
import type { Place } from '../../src/domain/types'
import { placeMarkerHtml } from '../../src/components/MapView'

const place: Place = {
  id: 'la',
  bookId: 'book',
  placeType: 'city',
  name: '洛杉矶',
  countryCode: 'US',
  lat: 34.05,
  lng: -118.24,
  visitor: 'together',
  updatedAt: '2026-10-04T00:00:00.000Z',
}

describe('placeMarkerHtml', () => {
  it('shows one photo as a single print', () => {
    const marker = placeMarkerHtml({ ...place, photos: ['https://example.test/a.jpg'] })
    expect(marker.html).not.toContain('pin--stack')
    expect(marker.html.match(/pin__shot/g)).toHaveLength(1)
  })

  it('fans extra photos out behind the front print', () => {
    const marker = placeMarkerHtml({
      ...place,
      photos: ['https://example.test/a.jpg', 'https://example.test/b.jpg', 'https://example.test/c.jpg', 'https://example.test/d.jpg'],
    })
    expect(marker.html).toContain('pin--stack')
    expect(marker.html).toContain('pin__shot--back')
    expect(marker.html).toContain('pin__shot--mid')
    expect(marker.html).toContain('pin__shot--front')
    expect(marker.html).toContain('>4<')
    expect(marker.html).not.toContain('https://example.test/d.jpg')
  })
})
