import { describe, expect, it } from 'vitest'
import { formatCityLabel, searchCities } from '../../src/geo/citySearch'

describe('searchCities', () => {
  it('finds cities by a partial English city name', () => {
    expect(searchCities('tok').some((hit) => hit.name === 'Tokyo')).toBe(true)
  })

  it('finds cities by Chinese name', () => {
    expect(searchCities('马尼拉').some((hit) => hit.name === 'Manila')).toBe(true)
    expect(searchCities('旧金山').some((hit) => hit.name === 'San Francisco')).toBe(true)
    expect(searchCities('上海').some((hit) => hit.name === 'Shanghai')).toBe(true)
    expect(searchCities('南京').some((hit) => hit.name === 'Nanjing')).toBe(true)
    expect(searchCities('北京').some((hit) => hit.name === 'Beijing')).toBe(true)
    expect(searchCities('张家口').some((hit) => hit.name === 'Zhangjiakou')).toBe(true)
    expect(searchCities('呈坎').some((hit) => hit.name === 'Chengkan')).toBe(true)
  })

  it('finds cities by English name for newly added destinations', () => {
    expect(searchCities('manila').some((hit) => hit.name === 'Manila')).toBe(true)
    expect(searchCities('san francisco').some((hit) => hit.name === 'San Francisco')).toBe(true)
    expect(searchCities('zanzibar').some((hit) => hit.countryCode === 'TZ')).toBe(true)
  })

  it('finds cities by Chinese country name', () => {
    const hits = searchCities('坦桑尼亚', 5)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((hit) => hit.countryCode === 'TZ')).toBe(true)
  })

  it('loads cities from the seed data', () => {
    const hits = searchCities('lisbon')
    expect(hits[0]).toMatchObject({
      name: 'Lisbon',
      nameZh: '里斯本',
      countryCode: 'PT',
    })
    expect(hits[0]?.lat).toBeGreaterThan(38)
    expect(hits[0]?.lng).toBeLessThan(-9)
  })

  it('returns no results for an empty query', () => {
    expect(searchCities('')).toHaveLength(0)
  })

  it('finds cities by country name and respects the limit', () => {
    const hits = searchCities('japan', 1)

    expect(hits).toHaveLength(1)
    expect(hits[0]?.countryCode).toBe('JP')
  })

  it('formats bilingual labels', () => {
    expect(formatCityLabel({ name: 'Manila', nameZh: '马尼拉' })).toBe('马尼拉 · Manila')
    expect(formatCityLabel({ name: 'Lisbon' })).toBe('Lisbon')
  })
})
