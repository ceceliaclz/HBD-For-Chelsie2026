export type Role = 'rabbit' | 'dog'

export type Visitor = 'rabbit' | 'dog' | 'together'

export type PlaceStatus = 'visited' | 'wish'

export type PlaceFilter = Visitor | 'all' | 'wish'

export type MarkerPack = 'stars' | 'stamps' | 'animals'

export interface CoupleBook {
  id: string
  inviteCode: string
  markerPack: MarkerPack
  createdAt: string
}

export interface Member {
  id: string
  bookId: string
  role: Role
  deviceToken: string
  joinedAt: string
}

export interface Place {
  id: string
  bookId: string
  placeType: 'country' | 'city'
  name: string
  countryCode: string
  lat: number
  lng: number
  visitor: Visitor
  /** Missing means already visited. Wishes do not fill the map or count as progress. */
  status?: PlaceStatus
  /** One line about why this place is a wish. Kept after it becomes a visit. */
  wishNote?: string
  visitedOn?: string
  /** Local photo data URLs. Missing or empty means 待添加. Not synced. */
  photos?: string[]
  updatedAt: string
}
