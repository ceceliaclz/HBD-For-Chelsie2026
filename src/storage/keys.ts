import type { Place } from '../domain/types'

export const META_KEYS = {
  deviceToken: 'deviceToken',
  book: 'book',
  member: 'member',
} as const

export function placeKey(place: Pick<Place, 'placeType' | 'countryCode' | 'name'>): string {
  return `${place.placeType}:${place.countryCode}:${place.name}`
}
