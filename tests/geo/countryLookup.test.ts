import { describe, expect, it } from 'vitest'
import type { Place, Visitor } from '../../src/domain/types'
import {
  countryFillExpression,
  dominantVisitorsByCountry,
  visitedCountryCodes,
} from '../../src/geo/countryLookup'

function place(countryCode: string, visitor: Visitor): Place {
  return {
    id: `${countryCode}-${visitor}`,
    bookId: 'book-1',
    placeType: 'country',
    name: countryCode,
    countryCode,
    lat: 0,
    lng: 0,
    visitor,
    updatedAt: '2026-08-09T00:00:00.000Z',
  }
}

describe('visitedCountryCodes', () => {
  it('includes only together countries when filtering together', () => {
    const places = [
      place('jp', 'rabbit'),
      place('ID', 'together'),
      place('FR', 'dog'),
    ]

    expect([...visitedCountryCodes(places, 'together')]).toEqual(['ID'])
  })

  it('normalizes country codes and ignores blank values', () => {
    const places = [place(' jp ', 'rabbit'), place('', 'dog')]

    expect([...visitedCountryCodes(places, 'all')]).toEqual(['JP'])
  })
})

describe('dominantVisitorsByCountry', () => {
  it('uses together when both partners have visited a country', () => {
    const result = dominantVisitorsByCountry([
      place('JP', 'rabbit'),
      place('JP', 'dog'),
      place('FR', 'rabbit'),
    ], 'all')

    expect(result).toEqual(new Map([
      ['JP', 'together'],
      ['FR', 'rabbit'],
    ]))
  })

  it('uses together when an explicit together visit exists', () => {
    const result = dominantVisitorsByCountry([
      place('ID', 'rabbit'),
      place('ID', 'together'),
    ], 'all')

    expect(result.get('ID')).toBe('together')
  })
})

describe('countryFillExpression', () => {
  it('matches either Natural Earth ISO property and uses role colors', () => {
    const expression = countryFillExpression(new Map([
      ['JP', 'rabbit'],
      ['ID', 'dog'],
      ['FR', 'together'],
    ]))

    expect(expression).toEqual([
      'match',
      ['upcase', ['coalesce', ['get', 'ISO_A2'], ['get', 'iso_a2'], '']],
      'JP',
      '#F5A0BF',
      'ID',
      '#8CC8FF',
      'FR',
      '#FFD278',
      'rgba(0, 0, 0, 0)',
    ])
  })
})
