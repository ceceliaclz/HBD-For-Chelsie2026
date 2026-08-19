// Country boundaries: Natural Earth 1:110m Admin 0 Countries.
import type { Place, Visitor } from '../domain/types'

/** MapLibre-style expression kept for unit tests / legacy helpers. */
export type ExpressionSpecification = unknown[] | string

/** Marker / accent colors (bright) — used on cities only. */
export const VISITOR_COLORS: Record<Visitor, string> = {
  rabbit: '#F5A0BF',
  dog: '#8CC8FF',
  together: '#FFD278',
}

/**
 * Distinct country washes. Deterministic by ISO code so the same country
 * always keeps the same color; different countries look different.
 */
export const COUNTRY_PALETTE = [
  '#C986A3', // rose
  '#7EB6E8', // sky
  '#E2B15A', // amber
  '#7BC4A8', // mint
  '#B59BE8', // lilac
  '#E0927A', // coral
  '#6DB3C8', // teal
  '#D4A0C7', // orchid
  '#8FBF7A', // leaf
  '#E0A36B', // apricot
  '#8AA4E0', // periwinkle
  '#D48B9C', // blush
] as const

export const COUNTRY_BORDER_FALLBACK = 'rgba(222, 231, 255, 0.28)'

function normalizedCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase()
}

function naturalEarthCountryCodeExpression(): unknown[] {
  const primaryCode = ['coalesce', ['get', 'ISO_A2'], ['get', 'iso_a2'], '']
  return [
    'upcase',
    [
      'case',
      ['==', primaryCode, '-99'],
      ['coalesce', ['get', 'ISO_A2_EH'], ''],
      primaryCode,
    ],
  ]
}

/** Stable hash → palette index for a country code. */
export function countryPaletteIndex(countryCode: string): number {
  const code = normalizedCountryCode(countryCode)
  let hash = 0
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 33 + code.charCodeAt(index)) >>> 0
  }
  return hash % COUNTRY_PALETTE.length
}

export function countryWashColor(countryCode: string): string {
  return COUNTRY_PALETTE[countryPaletteIndex(countryCode)] ?? COUNTRY_PALETTE[0]
}

/** Slightly brighter border sibling of the wash. */
export function countryBorderColor(countryCode: string): string {
  return countryWashColor(countryCode)
}

export function visitedCountryCodes(
  places: Place[],
  filter: Visitor | 'all',
): Set<string> {
  const codes = new Set<string>()

  for (const place of places) {
    const code = normalizedCountryCode(place.countryCode)
    if (code && (filter === 'all' || place.visitor === filter)) {
      codes.add(code)
    }
  }

  return codes
}

export function dominantVisitorsByCountry(
  places: Place[],
  filter: Visitor | 'all',
): Map<string, Visitor> {
  const visitors = new Map<string, Set<Visitor>>()

  for (const place of places) {
    const code = normalizedCountryCode(place.countryCode)
    if (!code || (filter !== 'all' && place.visitor !== filter)) continue

    const countryVisitors = visitors.get(code) ?? new Set<Visitor>()
    countryVisitors.add(place.visitor)
    visitors.set(code, countryVisitors)
  }

  return new Map(
    [...visitors].map(([code, countryVisitors]) => {
      const dominant: Visitor = countryVisitors.has('together')
        || (countryVisitors.has('rabbit') && countryVisitors.has('dog'))
        ? 'together'
        : (countryVisitors.values().next().value ?? 'together')
      return [code, dominant]
    }),
  )
}

function matchCountriesToColors(
  codes: Iterable<string>,
  colorForCode: (code: string) => string,
  fallback: string,
): ExpressionSpecification {
  const normalized = [...new Set([...codes].map(normalizedCountryCode).filter(Boolean))]
  if (normalized.length === 0) {
    return fallback as unknown as ExpressionSpecification
  }

  const expression: unknown[] = [
    'match',
    naturalEarthCountryCodeExpression(),
  ]
  for (const code of normalized) {
    expression.push(code, colorForCode(code))
  }
  expression.push(fallback)
  return expression as ExpressionSpecification
}

export function countryFillExpression(
  codes: Iterable<string>,
): ExpressionSpecification {
  const list = [...codes]
  if (list.length === 0) {
    return ['rgba', 0, 0, 0, 0]
  }
  return matchCountriesToColors(list, countryWashColor, 'rgba(0, 0, 0, 0)')
}

export function countryBorderExpression(
  codes: Iterable<string>,
): ExpressionSpecification {
  return matchCountriesToColors(
    codes,
    countryBorderColor,
    COUNTRY_BORDER_FALLBACK,
  )
}

export function cityDotColorExpression(): ExpressionSpecification {
  return [
    'match',
    ['get', 'visitor'],
    'rabbit',
    VISITOR_COLORS.rabbit,
    'dog',
    VISITOR_COLORS.dog,
    'together',
    VISITOR_COLORS.together,
    VISITOR_COLORS.together,
  ]
}
