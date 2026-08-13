import citySeed from '../data/cities-seed.json'
import countriesGeoJson from '../../public/geo/countries-110m.json'

export interface CityHit {
  name: string
  countryCode: string
  countryName: string
  lat: number
  lng: number
  nameZh?: string
  aliases?: string[]
}

interface SeedCity {
  name: string
  countryCode: string
  countryName: string
  lat: number
  lng: number
  nameZh?: string
  aliases?: string[]
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

const cities: CityHit[] = (citySeed as SeedCity[]).map((city) => ({
  ...city,
  countryName: COUNTRY_NAMES[city.countryCode] ?? city.countryName,
}))

/** Extra Chinese (and common) country aliases for bilingual search. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ['阿联酋', '阿拉伯联合酋长国'],
  AR: ['阿根廷'],
  AT: ['奥地利'],
  AU: ['澳大利亚', '澳洲'],
  BE: ['比利时'],
  BR: ['巴西'],
  CA: ['加拿大'],
  CH: ['瑞士'],
  CL: ['智利'],
  CN: ['中国', '国内'],
  CO: ['哥伦比亚'],
  CU: ['古巴'],
  CZ: ['捷克'],
  DE: ['德国'],
  DK: ['丹麦'],
  EG: ['埃及'],
  ES: ['西班牙'],
  ET: ['埃塞俄比亚'],
  FI: ['芬兰'],
  FJ: ['斐济'],
  FR: ['法国'],
  GB: ['英国', 'UK'],
  GH: ['加纳'],
  GR: ['希腊'],
  HK: ['香港'],
  HU: ['匈牙利'],
  ID: ['印度尼西亚', '印尼'],
  IE: ['爱尔兰'],
  IL: ['以色列'],
  IN: ['印度'],
  IS: ['冰岛'],
  IT: ['意大利'],
  JP: ['日本'],
  KE: ['肯尼亚'],
  KH: ['柬埔寨'],
  KR: ['韩国', '南韩'],
  LA: ['老挝'],
  LK: ['斯里兰卡'],
  MM: ['缅甸'],
  MO: ['澳门'],
  MV: ['马尔代夫'],
  MX: ['墨西哥'],
  MY: ['马来西亚'],
  NG: ['尼日利亚'],
  NL: ['荷兰'],
  NO: ['挪威'],
  NP: ['尼泊尔'],
  NZ: ['新西兰'],
  PE: ['秘鲁'],
  PH: ['菲律宾'],
  PL: ['波兰'],
  PT: ['葡萄牙'],
  QA: ['卡塔尔'],
  RU: ['俄罗斯'],
  SE: ['瑞典'],
  SG: ['新加坡'],
  TH: ['泰国'],
  TR: ['土耳其'],
  TW: ['台湾', '台灣'],
  TZ: ['坦桑尼亚', '坦桑'],
  US: ['美国', 'USA', '美利坚'],
  VN: ['越南'],
  ZA: ['南非'],
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase()
}

export function formatCityLabel(hit: Pick<CityHit, 'name' | 'nameZh'>): string {
  return hit.nameZh ? `${hit.nameZh} · ${hit.name}` : hit.name
}

export function searchCities(query: string, limit = 8): CityHit[] {
  const needle = normalize(query)
  if (!needle || limit <= 0) return []

  return cities
    .map((hit) => {
      const cityNames = [hit.name, hit.nameZh, ...(hit.aliases ?? [])].filter(
        (value): value is string => Boolean(value),
      )
      const countryNames = [
        hit.countryName,
        hit.countryCode,
        ...(COUNTRY_ENGLISH_ALIASES[hit.countryCode] ?? []),
        ...(COUNTRY_ALIASES[hit.countryCode] ?? []),
      ]
      const searchable = [...cityNames, ...countryNames].map(normalize)
      const normalizedCityNames = cityNames.map(normalize)

      const score = normalizedCityNames.some((value) => value.startsWith(needle))
        ? 0
        : normalizedCityNames.some((value) => value.includes(needle))
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
