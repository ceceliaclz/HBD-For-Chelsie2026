// Country boundaries: Natural Earth 1:110m Admin 0 Countries.
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Place, Visitor } from '../domain/types'

const VISITOR_COLORS: Record<Visitor, string> = {
  rabbit: '#F5A0BF',
  dog: '#8CC8FF',
  together: '#FFD278',
}

function normalizedCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase()
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

export function countryFillExpression(
  codesByVisitor: Map<string, Visitor>,
): ExpressionSpecification {
  const expression: unknown[] = [
    'match',
    ['upcase', ['coalesce', ['get', 'ISO_A2'], ['get', 'iso_a2'], '']],
  ]

  for (const [code, visitor] of codesByVisitor) {
    expression.push(normalizedCountryCode(code), VISITOR_COLORS[visitor])
  }

  expression.push('rgba(0, 0, 0, 0)')
  return expression as ExpressionSpecification
}
