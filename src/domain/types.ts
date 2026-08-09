export type Role = 'rabbit' | 'dog'

export type Visitor = 'rabbit' | 'dog' | 'together'

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
  visitedOn?: string
  updatedAt: string
}
