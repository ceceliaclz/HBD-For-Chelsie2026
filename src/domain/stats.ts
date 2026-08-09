import type { Place } from './types'

export function computeStats(places: Place[]) {
  const countries = new Set(places.map((p) => p.countryCode))
  return {
    countryCount: countries.size,
    cityCount: places.filter((p) => p.placeType === 'city').length,
    togetherCount: places.filter((p) => p.visitor === 'together').length,
  }
}
