export interface CityHit {
  name: string
  countryCode: string
  countryName: string
  lat: number
  lng: number
}

// Kept synchronous for instant typeahead; public/data/cities-seed.json is the
// portable seed asset used by importers and can be generated from this index.
const cities: CityHit[] = [
  { name: 'Tokyo', countryCode: 'JP', countryName: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka', countryCode: 'JP', countryName: 'Japan', lat: 34.6937, lng: 135.5023 },
  { name: 'Paris', countryCode: 'FR', countryName: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.5072, lng: -0.1276 },
  { name: 'New York', countryCode: 'US', countryName: 'United States of America', lat: 40.7128, lng: -74.006 },
  { name: 'Denpasar (Bali)', countryCode: 'ID', countryName: 'Indonesia', lat: -8.65, lng: 115.2167 },
  { name: 'Seoul', countryCode: 'KR', countryName: 'South Korea', lat: 37.5665, lng: 126.978 },
  { name: 'Bangkok', countryCode: 'TH', countryName: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { name: 'Singapore', countryCode: 'SG', countryName: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Sydney', countryCode: 'AU', countryName: 'Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Rome', countryCode: 'IT', countryName: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Barcelona', countryCode: 'ES', countryName: 'Spain', lat: 41.3874, lng: 2.1686 },
  { name: 'Amsterdam', countryCode: 'NL', countryName: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { name: 'Berlin', countryCode: 'DE', countryName: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Chiang Mai', countryCode: 'TH', countryName: 'Thailand', lat: 18.7883, lng: 98.9853 },
]

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
