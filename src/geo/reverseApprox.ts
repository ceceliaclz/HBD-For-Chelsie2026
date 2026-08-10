import citySeed from '../data/cities-seed.json'
import countriesGeoJson from '../../public/geo/countries-110m.json'
import type { CityHit } from './citySearch'

export interface LatLng {
  lng: number
  lat: number
}

export interface ApproxPlace {
  countryCode: string
  countryName: string
  nearestCity?: CityHit
}

type Position = [number, number]
type PolygonCoordinates = Position[][]
type Geometry =
  | { type: 'Polygon'; coordinates: PolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: PolygonCoordinates[] }

interface CountryFeature {
  properties: {
    NAME?: string
    ADMIN?: string
    ISO_A2?: string
    ISO_A2_EH?: string
  }
  geometry: Geometry
}

const countries = (countriesGeoJson as unknown as {
  features: CountryFeature[]
}).features
const cities = citySeed as CityHit[]
const EARTH_RADIUS_KM = 6371.0088

function radians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const deltaLat = radians(b.lat - a.lat)
  const deltaLng = radians(b.lng - a.lng)
  const latA = radians(a.lat)
  const latB = radians(b.lat)
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine))
}

export function nearestCity(
  lngLat: LatLng,
  candidates: CityHit[],
  maxKm = 80,
): CityHit | null {
  let nearest: CityHit | null = null
  let nearestKm = maxKm

  for (const city of candidates) {
    const distance = haversineKm(lngLat, city)
    if (distance <= nearestKm) {
      nearest = city
      nearestKm = distance
    }
  }

  return nearest
}

function longitudeNear(lng: number, reference: number): number {
  let result = lng
  while (result - reference > 180) result -= 360
  while (result - reference < -180) result += 360
  return result
}

function pointInRing(point: LatLng, ring: Position[]): boolean {
  let inside = false

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [rawLng, lat] = ring[index]
    const [rawPreviousLng, previousLat] = ring[previous]
    const lng = longitudeNear(rawLng, point.lng)
    const previousLng = longitudeNear(rawPreviousLng, point.lng)
    const crossesLatitude = (lat > point.lat) !== (previousLat > point.lat)
    const crossingLng = (previousLng - lng) * (point.lat - lat)
      / (previousLat - lat) + lng

    if (crossesLatitude && point.lng < crossingLng) inside = !inside
  }

  return inside
}

function pointInPolygon(point: LatLng, polygon: PolygonCoordinates): boolean {
  return pointInRing(point, polygon[0])
    && polygon.slice(1).every((hole) => !pointInRing(point, hole))
}

function containsPoint(feature: CountryFeature, point: LatLng): boolean {
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates
  return polygons.some((polygon) => pointInPolygon(point, polygon))
}

function featureCenter(feature: CountryFeature): LatLng {
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates
  const positions = polygons.flatMap((polygon) => polygon[0])
  let x = 0
  let y = 0
  let z = 0

  for (const [lng, lat] of positions) {
    const lngRad = radians(lng)
    const latRad = radians(lat)
    x += Math.cos(latRad) * Math.cos(lngRad)
    y += Math.cos(latRad) * Math.sin(lngRad)
    z += Math.sin(latRad)
  }

  return {
    lng: Math.atan2(y, x) * 180 / Math.PI,
    lat: Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)) * 180 / Math.PI,
  }
}

function countryCode(feature: CountryFeature): string {
  const { ISO_A2, ISO_A2_EH } = feature.properties
  return ISO_A2 && ISO_A2 !== '-99' ? ISO_A2 : (ISO_A2_EH ?? '')
}

function countryName(feature: CountryFeature): string {
  return feature.properties.NAME ?? feature.properties.ADMIN ?? countryCode(feature)
}

export function approxPlaceFromLngLat(lngLat: LatLng): ApproxPlace {
  const containing = countries.find((feature) => containsPoint(feature, lngLat))
  const country = containing ?? countries.reduce((nearest, feature) => (
    haversineKm(lngLat, featureCenter(feature))
      < haversineKm(lngLat, featureCenter(nearest))
      ? feature
      : nearest
  ))
  const code = countryCode(country)
  const city = nearestCity(
    lngLat,
    cities.filter((candidate) => candidate.countryCode === code),
  )

  return {
    countryCode: code,
    countryName: countryName(country),
    ...(city ? { nearestCity: city } : {}),
  }
}
