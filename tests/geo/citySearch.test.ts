import { describe, expect, it } from 'vitest'
import { searchCities } from '../../src/geo/citySearch'

describe('searchCities', () => {
  it('finds cities by a partial city name', () => {
    expect(searchCities('tok').some((hit) => hit.name === 'Tokyo')).toBe(true)
  })

  it('returns no results for an empty query', () => {
    expect(searchCities('')).toHaveLength(0)
  })

  it('finds cities by country name and respects the limit', () => {
    const hits = searchCities('japan', 1)

    expect(hits).toHaveLength(1)
    expect(hits[0]?.countryCode).toBe('JP')
  })
})
