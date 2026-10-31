import type { Place } from './types'
import { isWish } from './wishes'

export function computeStats(places: Place[]) {
  const visited = places.filter((place) => !isWish(place))
  const countries = new Set(visited.map((place) => place.countryCode))
  return {
    countryCount: countries.size,
    cityCount: visited.filter((place) => place.placeType === 'city').length,
    togetherCount: visited.filter((place) => place.visitor === 'together').length,
  }
}
