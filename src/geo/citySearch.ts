import citySeed from '../data/cities-seed.json'
import countriesGeoJson from '../../public/geo/countries-110m.json'

export interface CityHit {
  name: string
  countryCode: string
  countryName: string
  lat: number
  lng: number
}

interface CountryProperties {
  NAME?: string
  ADMIN?: string
  ISO_A2?: string
  ISO_A2_EH?: string
}

interface CountryGeoJson {
  features: Array<{ properties: CountryProperties }>
}

const countryProperties = (countriesGeoJson as CountryGeoJson).features

const COUNTRY_NAMES = Object.fromEntries(
  countryProperties.flatMap(({ properties }) => {
    const code = properties.ISO_A2 !== '-99'
      ? properties.ISO_A2
      : properties.ISO_A2_EH
    const name = properties.NAME ?? properties.ADMIN
    return code && name ? [[code, name]] : []
  }),
) as Record<string, string>

const COUNTRY_ENGLISH_ALIASES = Object.fromEntries(
  countryProperties.flatMap(({ properties }) => {
    const code = properties.ISO_A2 !== '-99'
      ? properties.ISO_A2
      : properties.ISO_A2_EH
    const aliases = [properties.NAME, properties.ADMIN].filter(
      (value): value is string => Boolean(value),
    )
    return code && aliases.length > 0 ? [[code, aliases]] : []
  }),
) as Record<string, string[]>

const cities: CityHit[] = citySeed.map((city) => ({
  ...city,
  countryName: COUNTRY_NAMES[city.countryCode] ?? city.countryName,
}))

const COUNTRY_ALIASES: Record<string, string[]> = {
  AU: ['澳大利亚'],
  DE: ['德国'],
  ES: ['西班牙'],
  FR: ['法国'],
  GB: ['英国', 'UK'],
  ID: ['印度尼西亚', '印尼'],
  IT: ['意大利'],
  JP: ['日本'],
  KR: ['韩国'],
  NL: ['荷兰'],
  SG: ['新加坡'],
  TH: ['泰国'],
  US: ['美国', 'USA'],
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase()
}

export function searchCities(query: string, limit = 8): CityHit[] {
  const needle = normalize(query)
  if (!needle || limit <= 0) return []

  return cities
    .map((hit) => {
      const searchable = [
        hit.name,
        hit.countryName,
        hit.countryCode,
        ...(COUNTRY_ENGLISH_ALIASES[hit.countryCode] ?? []),
        ...(COUNTRY_ALIASES[hit.countryCode] ?? []),
      ].map(normalize)
      const cityName = normalize(hit.name)
      const score = cityName.startsWith(needle)
        ? 0
        : cityName.includes(needle)
          ? 1
          : searchable.some((value) => value.startsWith(needle))
            ? 2
            : searchable.some((value) => value.includes(needle))
              ? 3
              : Number.POSITIVE_INFINITY
      return { hit, score }
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || a.hit.name.localeCompare(b.hit.name))
    .slice(0, limit)
    .map(({ hit }) => hit)
}
