import { describe, expect, it } from 'vitest'
import type { Place, Visitor } from '../../src/domain/types'
import {
  COUNTRY_PALETTE,
  countryFillExpression,
  countryWashColor,
  dominantVisitorsByCountry,
  visitedCountryCodes,
} from '../../src/geo/countryLookup'

type FeatureProperties = Record<string, string | undefined>

function evaluateExpression(
  expression: unknown,
  properties: FeatureProperties,
): unknown {
  if (!Array.isArray(expression)) return expression

  const [operator, ...args] = expression
  if (operator === 'get') return properties[String(args[0])]
  if (operator === 'coalesce') {
    return args
      .map((argument) => evaluateExpression(argument, properties))
      .find((value) => value !== null && value !== undefined)
  }
  if (operator === 'upcase') {
    return String(evaluateExpression(args[0], properties)).toUpperCase()
  }
  if (operator === '==') {
    return evaluateExpression(args[0], properties)
      === evaluateExpression(args[1], properties)
  }
  if (operator === 'case') {
    return evaluateExpression(args[0], properties)
      ? evaluateExpression(args[1], properties)
      : evaluateExpression(args[2], properties)
  }
  if (operator === 'match') {
    const input = evaluateExpression(args[0], properties)
    for (let index = 1; index < args.length - 1; index += 2) {
      if (input === evaluateExpression(args[index], properties)) {
        return evaluateExpression(args[index + 1], properties)
      }
    }
    return evaluateExpression(args.at(-1), properties)
  }

  throw new Error(`Unsupported expression operator: ${String(operator)}`)
}

function place(countryCode: string, visitor: Visitor): Place {
  return {
    id: `${countryCode}-${visitor}`,
    bookId: 'book-1',
    placeType: 'country',
    name: countryCode,
    countryCode,
    lat: 0,
    lng: 0,
    visitor,
    updatedAt: '2026-08-09T00:00:00.000Z',
  }
}

describe('visitedCountryCodes', () => {
  it('includes only together countries when filtering together', () => {
    const places = [
      place('jp', 'rabbit'),
      place('ID', 'together'),
      place('FR', 'dog'),
    ]

    expect([...visitedCountryCodes(places, 'together')]).toEqual(['ID'])
  })

  it('normalizes country codes and ignores blank values', () => {
    const places = [place(' jp ', 'rabbit'), place('', 'dog')]

    expect([...visitedCountryCodes(places, 'all')]).toEqual(['JP'])
  })
})

describe('dominantVisitorsByCountry', () => {
  it('uses together when both partners have visited a country', () => {
    const result = dominantVisitorsByCountry([
      place('JP', 'rabbit'),
      place('JP', 'dog'),
      place('FR', 'rabbit'),
    ], 'all')

    expect(result).toEqual(new Map([
      ['JP', 'together'],
      ['FR', 'rabbit'],
    ]))
  })

  it('uses together when an explicit together visit exists', () => {
    const result = dominantVisitorsByCountry([
      place('ID', 'rabbit'),
      place('ID', 'together'),
    ], 'all')

    expect(result.get('ID')).toBe('together')
  })
})

describe('countryFillExpression', () => {
  it('returns a valid transparent expression when no country is visited', () => {
    expect(countryFillExpression([])).toEqual(['rgba', 0, 0, 0, 0])
  })

  it('assigns different wash colors to different countries', () => {
    const expression = countryFillExpression(['JP', 'CN', 'FR'])

    const japan = evaluateExpression(expression, { ISO_A2: 'JP' })
    const china = evaluateExpression(expression, { ISO_A2: 'CN' })
    const france = evaluateExpression(expression, {
      ISO_A2: '-99',
      ISO_A2_EH: 'FR',
    })

    expect(japan).toBe(countryWashColor('JP'))
    expect(china).toBe(countryWashColor('CN'))
    expect(france).toBe(countryWashColor('FR'))
    expect(new Set([japan, china, france]).size).toBeGreaterThan(1)
    expect(evaluateExpression(expression, { ISO_A2: 'NO' }))
      .toBe('rgba(0, 0, 0, 0)')
  })

  it('keeps the same country on a stable palette color', () => {
    expect(countryWashColor('JP')).toBe(countryWashColor('jp'))
    expect(COUNTRY_PALETTE).toContain(countryWashColor('JP'))
  })
})
